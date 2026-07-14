/**
 * Minimal WCP4 identity validation (FDC3 2.2).
 * Origin checks + App Directory identityUrl match → WCP5 success/fail.
 * Optional host pending-instance adoption via `adoptInstanceId`.
 */

import { findBestAppMatchByIdentityUrl } from "./find-app-by-identity-url"
import type { AppConnectionRegistry } from "../app-connection-registry"
import type {
  AppConnectionMetadata,
  AppConnectionOptions,
  WCP4ValidateAppIdentityMessage,
  WCP5ValidateAppIdentityFailedMessage,
  WCP5ValidateAppIdentitySuccessMessage,
} from "./wcp-types"
import type { DirectoryApp } from "../../app-directory/DirectoryInterface"
import type { Logger } from "../logger"

export type Wcp4Context = {
  connectionRegistry: AppConnectionRegistry
  tempInstanceId: string
  getApps: () => DirectoryApp[]
  fdc3Version: string
  provider: string
  providerVersion?: string
  logger: Logger
  disconnectApp: (instanceId: string) => void
  onValidated: (metadata: AppConnectionMetadata) => void
  adoptInstanceId?: (args: {
    appId: string
    hostIdentifier?: string
  }) => string | undefined
}

export function handleWcp4ValidateAppIdentity(
  message: WCP4ValidateAppIdentityMessage,
  context: Wcp4Context,
): void {
  const { identityUrl, actualUrl } = message.payload
  const connectionAttemptUuid = message.meta.connectionAttemptUuid
  const pending = context.connectionRegistry.getConnection(
    context.tempInstanceId,
  )

  if (!pending) {
    context.logger.warn(
      `[WCP4] No pending connection for ${context.tempInstanceId}, ignoring`,
    )
    return
  }

  let identityOrigin: string
  let actualOrigin: string
  try {
    identityOrigin = new URL(identityUrl).origin
    actualOrigin = new URL(actualUrl).origin
  } catch {
    sendFailure(
      context,
      connectionAttemptUuid,
      "Invalid identityUrl or actualUrl",
    )
    return
  }

  if (identityOrigin !== actualOrigin) {
    sendFailure(
      context,
      connectionAttemptUuid,
      "Origin mismatch: identityUrl and actualUrl must have same origin",
    )
    return
  }

  if (!pending.messageOrigin) {
    sendFailure(
      context,
      connectionAttemptUuid,
      "Origin mismatch: WCP1Hello MessageEvent.origin must be provided",
    )
    return
  }

  if (pending.messageOrigin !== identityOrigin) {
    sendFailure(
      context,
      connectionAttemptUuid,
      "Origin mismatch: MessageEvent.origin must match identityUrl and actualUrl",
    )
    return
  }

  const app = findBestAppMatchByIdentityUrl(identityUrl, context.getApps())
  if (!app?.appId) {
    sendFailure(
      context,
      connectionAttemptUuid,
      "App not found in app directory",
    )
    return
  }

  const adopted = context.adoptInstanceId?.({
    appId: app.appId,
    hostIdentifier: pending.hostIdentifier,
  })
  const instanceId = adopted ?? `sail-${crypto.randomUUID()}`
  const instanceUuid = adopted ?? crypto.randomUUID()

  context.connectionRegistry.migrateInstanceId(
    context.tempInstanceId,
    instanceId,
    app.appId,
  )

  const metadata = context.connectionRegistry.getConnection(instanceId)
  if (!metadata) {
    sendFailure(
      context,
      connectionAttemptUuid,
      "Connection lost during validation",
    )
    return
  }

  const response = {
    type: "WCP5ValidateAppIdentityResponse",
    meta: {
      connectionAttemptUuid,
      timestamp: new Date().toISOString(),
    },
    payload: {
      appId: app.appId,
      instanceId,
      instanceUuid,
      implementationMetadata: {
        fdc3Version: context.fdc3Version,
        provider: context.provider,
        providerVersion: context.providerVersion,
        optionalFeatures: {
          OriginatingAppMetadata: false,
          UserChannelMembershipAPIs: true,
          DesktopAgentBridging: false,
        },
        appMetadata: {
          appId: app.appId,
          instanceId,
          name: app.name,
          title: app.title,
          description: app.description,
          icons: app.icons,
          screenshots: app.screenshots,
        },
      },
    },
  } as unknown as WCP5ValidateAppIdentitySuccessMessage

  context.connectionRegistry.sendOnPort(instanceId, response)
  context.onValidated(metadata)
}

function sendFailure(
  context: Wcp4Context,
  connectionAttemptUuid: string,
  message: string,
): void {
  context.logger.warn(`[WCP4] Validation failed: ${message}`)

  const response = {
    type: "WCP5ValidateAppIdentityFailedResponse",
    meta: {
      connectionAttemptUuid,
      timestamp: new Date().toISOString(),
    },
    payload: { message },
  } as unknown as WCP5ValidateAppIdentityFailedMessage

  context.connectionRegistry.sendOnPort(context.tempInstanceId, response)
  context.disconnectApp(context.tempInstanceId)
}

/** Narrow options used when constructing WCP4 context from BrowserAppConnection. */
export type Wcp4Options = Required<
  Pick<AppConnectionOptions, "getApps" | "fdc3Version" | "provider">
> &
  Pick<AppConnectionOptions, "providerVersion">
