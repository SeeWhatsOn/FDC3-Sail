/**
 * WCP message types and guards (FDC3 2.2 Web Connection Protocol).
 * Spec: website/versioned_docs/version-2.2/api/specs/webConnectionProtocol.md (git ref v2.2)
 */

import { BrowserTypes } from "@finos/fdc3"
import type { DirectoryApp } from "../../app-directory/DirectoryInterface"
import type { Logger } from "../logger"

export type WCP1HelloMessage = BrowserTypes.WebConnectionProtocol1Hello
export type WCP3HandshakeMessage = BrowserTypes.WebConnectionProtocol3Handshake
export type WCP4ValidateAppIdentityMessage =
  BrowserTypes.WebConnectionProtocol4ValidateAppIdentity
export type WCP5ValidateAppIdentitySuccessMessage =
  BrowserTypes.WebConnectionProtocol5ValidateAppIdentitySuccessResponse
export type WCP5ValidateAppIdentityFailedMessage =
  BrowserTypes.WebConnectionProtocol5ValidateAppIdentityFailedResponse
export type WCP6GoodbyeMessage = BrowserTypes.WebConnectionProtocol6Goodbye

export type AppConnectionMetadata = {
  instanceId: string
  appId: string
  connectionAttemptUuid: string
  messageOrigin: string
  source?: Window
  port?: MessagePort
  connectedAt: Date
  hostIdentifier?: string
}

export type AppConnectionOptions = {
  /** Directory apps used for WCP4 identityUrl matching. */
  getApps: () => DirectoryApp[]
  fdc3Version?: string
  /** Timeout waiting for WCP4 after WCP3 (ms). Default 5000. */
  handshakeTimeout?: number
  provider?: string
  providerVersion?: string
  logger?: Logger
  resolveHostIdentifier?: (source: Window) => string | undefined
  /**
   * Adopt a host-pre-registered pending instance id (e.g. iframe `name` / launcher id)
   * instead of minting a new `sail-{uuid}` on WCP4 success.
   */
  adoptInstanceId?: (args: {
    appId: string
    hostIdentifier?: string
  }) => string | undefined
}

export function isWCP1Hello(message: unknown): message is WCP1HelloMessage {
  if (message === null || typeof message !== "object") return false
  const m = message as Record<string, unknown>
  if (m.type !== "WCP1Hello") return false
  const meta = m.meta
  if (meta === null || typeof meta !== "object") return false
  return (
    typeof (meta as Record<string, unknown>).connectionAttemptUuid === "string"
  )
}

export function isWCP4ValidateAppIdentity(
  message: unknown,
): message is WCP4ValidateAppIdentityMessage {
  return BrowserTypes.isWebConnectionProtocol4ValidateAppIdentity(message)
}

export function isWCP6Goodbye(message: unknown): message is WCP6GoodbyeMessage {
  return BrowserTypes.isWebConnectionProtocol6Goodbye(message)
}

/** App→DA messages: DACP requests or WCP messages. */
export function isAppMessage(message: unknown): boolean {
  if (message === null || typeof message !== "object") return false
  const type = (message as { type?: unknown }).type
  if (typeof type !== "string") return false
  return type.endsWith("Request") || type.startsWith("WCP")
}
