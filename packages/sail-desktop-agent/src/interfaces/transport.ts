/**
 * Transport Interface
 *
 * Legacy test-only abstraction for handler-level DACP delivery recording.
 * Production browser hosts use {@link createBrowserDesktopAgent} with
 * {@link BrowserAppConnection} — not `Transport`.
 *
 * Vitest/Cucumber DACP oracle tests should attach {@link DacpTestAppConnection}
 * from test support to {@link DesktopAgent}, or call handlers via
 * {@link createDACPTestContext} with a mock transport as `DacpResponseDispatcher`.
 */

/**
 * Handler function for incoming messages from apps
 */
export type MessageHandler = (message: unknown) => void | Promise<void>

/**
 * Handler function for disconnect events
 */
export type DisconnectHandler = () => void

/**
 * @internal Legacy transport for handler-isolated tests and outbound recorders.
 */
export interface Transport {
  send(message: unknown): void
  onMessage(handler: MessageHandler): void
  onDisconnect(handler: DisconnectHandler): void
  isConnected(): boolean
  getInstanceId(): string | null
  disconnect(): void
}
