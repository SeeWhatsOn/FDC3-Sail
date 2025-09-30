/**
 * FDC3 Desktop Agent Transport Layer
 *
 * Provides transport-agnostic communication for DACP messages,
 * supporting multiple transport mechanisms.
 */

// Core types
export type {
  DACPMessage,
  TransportAdapter,
  TransportConfig,
  TransportEvents
} from './types'

// Adapters
export {
  createSocketIOAdapter,
  isSocketIOSocket
} from './socket-io-adapter'

export {
  createMessagePortAdapter,
  isMessagePort
} from './message-port-adapter'