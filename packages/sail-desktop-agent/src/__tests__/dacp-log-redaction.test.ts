import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"

import {
  assertSensitiveValueAbsentFromNonDebugLogs,
  createCapturingLogger,
  SENSITIVE_MARKER,
  serializeLogCalls,
  serializeNonDebugLogs,
} from "./utils/capturing-logger"
import { connectInstance, updateInstanceState } from "../state/mutators"
import { AppInstanceState } from "../state/types"
import { createInitialState } from "../state/initial-state"
import { DEFAULT_FDC3_USER_CHANNELS } from "../default-user-channels"
import { resolveDesktopAgentConfig } from "../agent/default-config"
import type { DesktopAgentOptions } from "../agent/desktop-agent"
import type { DACPHandlerContext } from "../handlers/types"
import { handleRaiseIntentRequest } from "../handlers/intents/intent-raise-intent"
import { routeDACPMessage } from "../handlers"
import { MockTransport } from "./utils/mock-transport"
import { createDACPTestContext, withResponseDispatcher } from "../handlers/__tests__/test-context"
import { clearAllPendingOpenWithContextTimeoutsForTesting } from "../handlers/utils/open-with-context"
import { clearAllHeartbeatTimersForTesting } from "../handlers/heartbeat/runtime"

type LogPayloadDetail = "metadata" | "full"

type LoggingAwareOptions = {
  logPayloadDetail?: LogPayloadDetail
}

type LoggingAwareDesktopAgentOptions = DesktopAgentOptions & LoggingAwareOptions

type LoggingAwareHandlerContext = DACPHandlerContext & LoggingAwareOptions

const SENSITIVE_CONTEXT = {
  type: "fdc3.instrument",
  accountNumber: SENSITIVE_MARKER,
} as const

function createSensitiveRaiseIntentMessage(instanceId: string): BrowserTypes.RaiseIntentRequest {
  return {
    type: "raiseIntentRequest",
    meta: {
      requestUuid: "raise-intent-log-redaction-uuid",
      timestamp: new Date(),
      source: { instanceId, appId: "SourceApp" },
    },
    payload: {
      intent: "ViewInstrument",
      context: SENSITIVE_CONTEXT,
    },
  }
}

function createConnectedRaiseIntentContext(options: {
  instanceId?: string
  logger: ReturnType<typeof createCapturingLogger>
  logPayloadDetail?: LogPayloadDetail
}): LoggingAwareHandlerContext {
  const instanceId = options.instanceId ?? "source-instance"
  let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
  state = connectInstance(state, {
    instanceId,
    appId: "SourceApp",
    metadata: { appId: "SourceApp", name: "SourceApp" },
  })
  state = updateInstanceState(state, instanceId, AppInstanceState.CONNECTED)

  const transport = new MockTransport()
  const { context } = createDACPTestContext({ instanceId, initialState: state })
  return {
    ...withResponseDispatcher(context, transport),
    logger: options.logger,
    logPayloadDetail: options.logPayloadDetail,
  }
}

afterEach(() => {
  clearAllPendingOpenWithContextTimeoutsForTesting()
  clearAllHeartbeatTimersForTesting()
  vi.useRealTimers()
})

describe("DACP/WCP metadata-only log redaction", () => {
  describe("default metadata-only logging", () => {
    it("does not include sensitive context values in raiseIntentRequest info logs", async () => {
      const logger = createCapturingLogger()
      const context = createConnectedRaiseIntentContext({ logger, logPayloadDetail: "metadata" })
      const message = createSensitiveRaiseIntentMessage(context.instanceId)

      await handleRaiseIntentRequest(message, context)

      assertSensitiveValueAbsentFromNonDebugLogs(logger)
    })

    it("includes metadata fields but not full payload in raiseIntentRequest info logs", async () => {
      const logger = createCapturingLogger()
      const context = createConnectedRaiseIntentContext({ logger, logPayloadDetail: "metadata" })
      const message = createSensitiveRaiseIntentMessage(context.instanceId)

      await handleRaiseIntentRequest(message, context)

      const infoPayload = serializeNonDebugLogs(logger)
      expect(infoPayload).toContain("raiseIntentRequest")
      expect(infoPayload).toContain("accountNumber")
      expect(infoPayload).not.toContain(SENSITIVE_MARKER)
    })

    it("does not include sensitive context values in DACP router info logs", async () => {
      const logger = createCapturingLogger()
      const context = createConnectedRaiseIntentContext({ logger, logPayloadDetail: "metadata" })
      const message = createSensitiveRaiseIntentMessage(context.instanceId)

      await routeDACPMessage(message, context)

      assertSensitiveValueAbsentFromNonDebugLogs(logger)
    })

    it("defaults logPayloadDetail to metadata when omitted from DesktopAgent config", () => {
      const config = resolveDesktopAgentConfig({} as LoggingAwareDesktopAgentOptions)
      expect(config).toHaveProperty("logPayloadDetail", "metadata")
    })
  })

  describe("opt-in full payload logging", () => {
    it("emits full sensitive payload only on debug when logPayloadDetail is full", async () => {
      const logger = createCapturingLogger()
      const context = createConnectedRaiseIntentContext({ logger, logPayloadDetail: "full" })
      const message = createSensitiveRaiseIntentMessage(context.instanceId)

      await handleRaiseIntentRequest(message, context)

      assertSensitiveValueAbsentFromNonDebugLogs(logger)
      expect(serializeLogCalls(logger.debugCalls)).toContain(SENSITIVE_MARKER)
    })

    it("keeps metadata-only shape at info when logPayloadDetail is full", async () => {
      const logger = createCapturingLogger()
      const context = createConnectedRaiseIntentContext({ logger, logPayloadDetail: "full" })
      const message = createSensitiveRaiseIntentMessage(context.instanceId)

      await handleRaiseIntentRequest(message, context)

      const raiseIntentInfoCall = logger.infoCalls.find(call =>
        call.message.includes("Processing raise intent request"),
      )
      expect(raiseIntentInfoCall).toBeDefined()
      const infoArgs = JSON.stringify(raiseIntentInfoCall?.args ?? [])
      expect(infoArgs).toContain("contextType")
      expect(infoArgs).toContain("contextKeys")
      expect(infoArgs).not.toContain("contextPayload")
      expect(infoArgs).not.toContain(SENSITIVE_MARKER)
    })
  })

  describe("injectable logger contract", () => {
    it("routes logDACPMessage output through the injected handler logger", async () => {
      const logger = createCapturingLogger()
      const context = createConnectedRaiseIntentContext({ logger, logPayloadDetail: "metadata" })
      const message = {
        type: "getInfoRequest",
        meta: {
          requestUuid: "get-info-log-redaction-uuid",
          source: { instanceId: context.instanceId, appId: "SourceApp" },
        },
        payload: {
          sensitiveField: SENSITIVE_MARKER,
        },
      }

      await routeDACPMessage(message, context)

      const dacpIncomingDebug = logger.debugCalls.some(call =>
        call.message.includes("DACP INCOMING"),
      )
      expect(dacpIncomingDebug).toBe(true)
    })
  })
})
