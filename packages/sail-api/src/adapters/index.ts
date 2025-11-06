/**
 * Sail Adapters
 *
 * Environment-specific implementations of Desktop Agent interfaces.
 * These adapters connect the pure Desktop Agent core to Sail's
 * Socket.IO transport and browser-based app launching.
 */

export { SocketIOTransport } from "./SocketIOTransport"
export { SailAppLauncher, type SailAppLauncherConfig } from "./SailAppLauncher"
