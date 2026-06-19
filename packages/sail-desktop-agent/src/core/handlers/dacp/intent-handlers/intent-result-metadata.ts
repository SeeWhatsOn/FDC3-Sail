import type { BrowserTypes, Context } from "@finos/fdc3"

/** DA-generated + optional app-provided fields for IntentResolution.getResultMetadata(). */
export type IntentResultContextMetadata = {
  source: { appId: string; instanceId: string }
  timestamp: string
  traceId: string
  signature?: string
  custom?: Record<string, unknown>
}

type AppProvidedResultMetadata = {
  traceId?: string
  signature?: string
  custom?: Record<string, unknown>
}

function isAppProvidedMetadata(value: unknown): value is AppProvidedResultMetadata {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    record.traceId !== undefined || record.signature !== undefined || record.custom !== undefined
  )
}

function isContextWithMetadataResult(
  intentResult: Record<string, unknown>
): intentResult is { context: Context; metadata: AppProvidedResultMetadata } {
  return (
    "context" in intentResult &&
    typeof intentResult.context === "object" &&
    intentResult.context !== null &&
    "metadata" in intentResult &&
    isAppProvidedMetadata(intentResult.metadata)
  )
}

function buildDaResultMetadata(
  targetAppId: string,
  targetInstanceId: string,
  timestamp: string,
  daTraceId: string
): IntentResultContextMetadata {
  return {
    source: { appId: targetAppId, instanceId: targetInstanceId },
    timestamp,
    traceId: daTraceId,
  }
}

/**
 * Normalize handler intentResult for raiseIntentResultResponse and build result metadata.
 *
 * ContextWithMetadata handlers return `{ context, metadata }` on the wire; getResult() receives
 * plain `{ context }` while getResultMetadata() receives merged DA + app fields.
 */
export function buildIntentResultWirePayload(
  intentResult: BrowserTypes.IntentResult | Record<string, unknown>,
  targetAppId: string,
  targetInstanceId: string,
  timestamp: string
): {
  wireIntentResult: BrowserTypes.IntentResult
  resultMetadata: IntentResultContextMetadata
} {
  const daTraceId = crypto.randomUUID()
  const baseMetadata = buildDaResultMetadata(targetAppId, targetInstanceId, timestamp, daTraceId)

  if (typeof intentResult !== "object" || intentResult === null) {
    return { wireIntentResult: {}, resultMetadata: baseMetadata }
  }

  const record = intentResult as Record<string, unknown>

  if (isContextWithMetadataResult(record)) {
    const appMetadata = record.metadata
    return {
      wireIntentResult: { context: record.context },
      resultMetadata: {
        ...baseMetadata,
        ...(appMetadata.signature !== undefined ? { signature: appMetadata.signature } : {}),
        ...(appMetadata.custom !== undefined ? { custom: appMetadata.custom } : {}),
      },
    }
  }

  if ("channel" in record && record.channel !== undefined) {
    return {
      wireIntentResult: { channel: record.channel as BrowserTypes.Channel },
      resultMetadata: baseMetadata,
    }
  }

  if ("context" in record && record.context !== undefined) {
    return {
      wireIntentResult: { context: record.context as Context },
      resultMetadata: baseMetadata,
    }
  }

  return { wireIntentResult: {}, resultMetadata: baseMetadata }
}
