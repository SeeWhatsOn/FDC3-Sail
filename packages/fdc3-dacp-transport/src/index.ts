/**
 * @finos/fdc3-dacp-transport
 *
 * Transport abstraction layer for routing FDC3 Desktop Agent Communication Protocol (DACP)
 * messages over different transport mechanisms (Socket.IO, MessagePort, etc.)
 *
 * This library provides:
 * - Transport adapters for Socket.IO and MessagePort
 * - WCP (Web Connection Protocol) handshake handler
 * - Type-safe interfaces for building custom transports
 *
 * @example Socket.IO Transport
 * ```typescript
 * import { createWCPHandler, createSocketIOTransport } from '@finos/fdc3-dacp-transport'
 * import { io } from 'socket.io-client'
 *
 * const socket = io('http://localhost:3000')
 * const transport = createSocketIOTransport({
 *   socket,
 *   sessionInfo: { userSessionId: '123', instanceId: 'abc', appId: 'myapp' }
 * })
 *
 * const handler = createWCPHandler({
 *   transport,
 *   sessionInfo: { userSessionId: '123', instanceId: 'abc', appId: 'myapp' },
 *   intentResolverUrl: 'https://example.com/intent-resolver',
 *   channelSelectorUrl: 'https://example.com/channel-selector'
 * })
 *
 * window.addEventListener('message', (event) => {
 *   handler.handleWCPMessage(event, iframeWindow)
 * })
 * ```
 *
 * @example MessagePort Transport
 * ```typescript
 * import { createWCPHandler, createMessagePortTransport } from '@finos/fdc3-dacp-transport'
 *
 * const channel = new MessageChannel()
 * const transport = createMessagePortTransport({ port: channel.port2 })
 *
 * const handler = createWCPHandler({
 *   transport,
 *   sessionInfo: { userSessionId: '123', instanceId: 'abc', appId: 'myapp' }
 * })
 * ```
 */

// Export transport adapters
export { createSocketIOTransport } from './transports/socketio'
export { createMessagePortTransport } from './transports/messageport'

// Export WCP handler
export { createWCPHandler } from './wcp-handler'

// Export types
export type {
  DACPTransport,
  DACPMessage,
  SessionInfo,
  WCPHandlerConfig,
  WCPHandlerResult,
  TransportFactory,
  SocketIOTransportConfig,
  MessagePortTransportConfig,
} from './types'