/**
 * Pure WCP3Handshake builder (FDC3 2.2).
 * Injected UI URLs are omitted (`false`) until a host wires them end-to-end.
 */

import type { WCP3HandshakeMessage } from "./wcp-types"

export type CreateWcp3HandshakeParams = {
  connectionAttemptUuid: string
  fdc3Version?: string
  timestamp?: string
}

export function createWcp3Handshake(
  params: CreateWcp3HandshakeParams,
): WCP3HandshakeMessage {
  // Spec wire format uses ISO-8601 strings for meta.timestamp (FDC3 2.2 WCP).
  // Generated BrowserTypes currently type timestamp as Date — cast through unknown.
  return {
    type: "WCP3Handshake",
    meta: {
      connectionAttemptUuid: params.connectionAttemptUuid,
      timestamp: params.timestamp ?? new Date().toISOString(),
    },
    payload: {
      fdc3Version: params.fdc3Version ?? "2.2",
      intentResolverUrl: false,
      channelSelectorUrl: false,
    },
  } as unknown as WCP3HandshakeMessage
}
