/**
 * Sail Adapters
 *
 * Environment-specific implementations of Desktop Agent interfaces.
 * These adapters connect the pure Desktop Agent core to Sail's
 * Socket.IO transport and browser-based app launching.
 */

export { SocketIOTransport } from "./socket-io-transport"
export { SailAppLauncher, type SailAppLauncherConfig } from "./SailAppLauncher"
export {
  MiddlewareTransport,
  type MiddlewareTransportOptions,
  type TransportMiddleware,
  createLoggingMiddleware,
  createFilterMiddleware,
  createTransformMiddleware,
  createMetricsMiddleware,
} from "./middleware-transport"
