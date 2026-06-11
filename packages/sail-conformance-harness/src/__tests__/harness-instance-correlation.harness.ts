import { expect } from "vitest"
import { AppDirectoryManager, DesktopAgent, type Logger } from "@finos/sail-desktop-agent"
import { MockTransport } from "../../../sail-desktop-agent/test/support/mock-transport"
import { createHarnessAppLauncher } from "../app-launcher"
import type { HarnessPanel } from "../types"

/** Expected harness debug log prefix once Phase 1 correlation logging lands. */
export const HARNESS_CORRELATION_LOG_TAG = "[ConformanceHarness] instance-identity-correlation"

export type InstanceIdentityCorrelationSnapshot = {
  launcherInstanceId: string
  iframeName: string
  wcp5InstanceId: string
  findInstancesInstanceIds: string[]
}

export type HarnessCorrelationRunOptions = {
  logger?: Logger
  logPayloadDetail?: "metadata" | "full"
}

/**
 * Phase 1 spike fixture: harness AppLauncher open → iframe name → WCP4/WCP5 → findInstances.
 * Uses public DesktopAgent APIs and the same DACP message shapes as Cucumber steps.
 */
export async function runHarnessOpenAndWcpHandshake(
  options: HarnessCorrelationRunOptions = {}
): Promise<InstanceIdentityCorrelationSnapshot> {
  const appId = "ChartApp"
  const appUrl = "https://example.com/chart-app"
  const callerConnectionId = "conformance1-caller"

  const panels: HarnessPanel[] = []
  const appLauncher = createHarnessAppLauncher(panel => {
    panels.push(panel)
  })

  const appDirectory = new AppDirectoryManager()
  appDirectory.addApplications([
    {
      appId,
      title: "Chart App",
      type: "web",
      details: { url: appUrl },
    },
    {
      appId: "Conformance1",
      title: "Conformance Framework",
      type: "web",
      details: { url: "https://example.com/conformance1" },
    },
  ])

  const transport = new MockTransport()
  const agent = new DesktopAgent({
    transport,
    appDirectoryManager: appDirectory,
    appLauncher,
    logger: options.logger,
    logPayloadDetail: options.logPayloadDetail ?? "full",
  })
  agent.start()

  const callerCanonicalId = await completeWcp4Handshake(transport, {
    connectionAttemptUuid: "caller-connect",
    appUrl: "https://example.com/conformance1",
    claimedInstanceId: callerConnectionId,
  })

  transport.clear()

  await transport.receiveMessage({
    type: "openRequest",
    meta: {
      requestUuid: crypto.randomUUID(),
      timestamp: new Date(),
      source: {
        appId: "Conformance1",
        instanceId: callerCanonicalId,
      },
    },
    payload: {
      app: {
        appId,
        desktopAgent: "n/a",
      },
    },
  })

  const openResponse = transport.allMessages
    .map(record => record.msg)
    .find(message => message.type === "openResponse") as
    | {
        type: "openResponse"
        payload?: { appIdentifier?: { instanceId?: string } }
      }
    | undefined
  expect(openResponse?.type).toBe("openResponse")
  const launcherInstanceId = openResponse?.payload?.appIdentifier?.instanceId
  expect(launcherInstanceId).toBeDefined()

  const launchedPanel = panels.find(panel => panel.appId === appId)
  expect(launchedPanel).toBeDefined()
  const iframeName = launchedPanel!.instanceId
  expect(iframeName).toBe(launcherInstanceId)

  const wcp5InstanceId = await completeWcp4Handshake(transport, {
    connectionAttemptUuid: "launched-app-connect",
    appUrl,
    claimedInstanceId: launcherInstanceId!,
  })

  transport.clear()

  await transport.receiveMessage({
    type: "findInstancesRequest",
    meta: {
      requestUuid: crypto.randomUUID(),
      timestamp: new Date(),
      source: {
        appId: "Conformance1",
        instanceId: callerCanonicalId,
      },
    },
    payload: {
      app: {
        appId,
        desktopAgent: "n/a",
      },
    },
  })

  const findInstancesResponse = transport.allMessages
    .map(record => record.msg)
    .find(message => message.type === "findInstancesResponse") as
    | {
        type: "findInstancesResponse"
        payload?: { appIdentifiers?: Array<{ instanceId?: string }> }
      }
    | undefined
  expect(findInstancesResponse?.type).toBe("findInstancesResponse")
  const findInstancesInstanceIds =
    findInstancesResponse?.payload?.appIdentifiers
      ?.map(identifier => identifier.instanceId)
      .filter((id): id is string => typeof id === "string") ?? []

  const snapshot: InstanceIdentityCorrelationSnapshot = {
    launcherInstanceId: launcherInstanceId!,
    iframeName,
    wcp5InstanceId,
    findInstancesInstanceIds,
  }

  // Emit harness correlation log when a logger is wired (e.g. logPayloadDetail: 'full').
  if (options.logger) {
    options.logger.debug(HARNESS_CORRELATION_LOG_TAG, snapshot)
  }

  return snapshot
}

function readWcp5InstanceId(transport: MockTransport): string {
  const wcp5 = transport.allMessages
    .map(record => record.msg)
    .find(message => message.type === "WCP5ValidateAppIdentityResponse") as
    | { payload?: { instanceId?: string } }
    | undefined

  const fromPayload = wcp5?.payload?.instanceId
  if (fromPayload) {
    return fromPayload
  }

  expect(transport.lastWcp5ValidatedInstanceId).toBeDefined()
  return transport.lastWcp5ValidatedInstanceId!
}

async function completeWcp4Handshake(
  transport: MockTransport,
  params: {
    connectionAttemptUuid: string
    appUrl: string
    claimedInstanceId: string
  }
): Promise<string> {
  await transport.receiveMessage({
    type: "WCP4ValidateAppIdentity",
    meta: {
      connectionAttemptUuid: params.connectionAttemptUuid,
      timestamp: new Date().toISOString(),
      messageOrigin: new URL(params.appUrl).origin,
    },
    payload: {
      instanceId: params.claimedInstanceId,
      instanceUuid: params.claimedInstanceId,
      identityUrl: params.appUrl,
      actualUrl: params.appUrl,
    },
  })

  return readWcp5InstanceId(transport)
}

/**
 * Phase 1 spike assertions: all four correlation fields are present and reflect
 * today's agent behavior (host launcher id vs WCP5 canonical id diverge on first connect).
 */
export function assertInstanceIdentityCorrelated(
  snapshot: InstanceIdentityCorrelationSnapshot
): void {
  const { launcherInstanceId, iframeName, wcp5InstanceId, findInstancesInstanceIds } = snapshot

  expect(launcherInstanceId).toBeTruthy()
  expect(iframeName).toBeTruthy()
  expect(wcp5InstanceId).toBeTruthy()

  // Harness contract: iframe name mirrors AppLauncher.instanceId at open time.
  expect(iframeName).toBe(launcherInstanceId)

  // WCP4 createAppInstance mints a fresh UUID on first connect; reconnect reuse
  // only applies when sourceWindow + identity registry already match the claimed id.
  expect(wcp5InstanceId).not.toBe(launcherInstanceId)

  // findInstances() lists canonical WCP5-registered instances, not launcher placeholders.
  expect(findInstancesInstanceIds).toEqual(expect.arrayContaining([wcp5InstanceId]))
  expect(findInstancesInstanceIds).not.toEqual(expect.arrayContaining([launcherInstanceId]))
}

export function findHarnessCorrelationLog(
  lines: string[]
): InstanceIdentityCorrelationSnapshot | undefined {
  const line = lines.find(entry => entry.includes(HARNESS_CORRELATION_LOG_TAG))
  if (!line) {
    return undefined
  }

  const jsonStart = line.indexOf("{")
  if (jsonStart === -1) {
    return undefined
  }

  try {
    return JSON.parse(line.slice(jsonStart)) as InstanceIdentityCorrelationSnapshot
  } catch {
    return undefined
  }
}
