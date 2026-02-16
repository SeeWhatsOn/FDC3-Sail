/**
 * FDC3 Desktop Agent - Core Package
 *
 * This is the main entry point for the FDC3 Desktop Agent core.
 * It exports only environment-agnostic components.
 *
 * ## Tree-Shaking
 *
 * Browser-specific code is NOT exported from this entry point.
 * To use browser functionality, import from the /browser submodule:
 *
 * ```typescript
 * // ✅ Core only (no browser code in bundle)
 * import { DesktopAgent } from '@finos/fdc3-sail-desktop-agent'
 *
 * // ✅ Browser module (includes WCP connector)
 * import { createBrowserDesktopAgent } from '@finos/fdc3-sail-desktop-agent/browser'
 *
 * // ✅ Transports module
 * import { createInMemoryTransportPair } from '@finos/fdc3-sail-desktop-agent/transports'
 * ```
 *
 * ## What's Exported
 *
 * - **DesktopAgent** - Core Desktop Agent class
 * - **Interfaces** - Transport, AppLauncher
 * - **State Registries** - App, Intent, Channel registries
 * - **App Directory** - App directory manager
 * - **Types** - TypeScript types and interfaces
 *
 * ## What's NOT Exported (Tree-Shakeable)
 *
 * - Browser WCP connector → Use `/browser` submodule
 * - MessagePort transport → Use `/browser` submodule
 * - InMemory transport → Use `/transports` submodule
 */

// Re-export everything from core
export * from "./core"

// NOTE: Browser-specific code is NOT exported here
// Import from @finos/fdc3-sail-desktop-agent/browser for:
// - createBrowserDesktopAgent()
// - WCPConnector
// - MessagePortTransport

// NOTE: Transport implementations are NOT exported here
// Import from @finos/fdc3-sail-desktop-agent/transports for:
// - InMemoryTransport
// - createInMemoryTransportPair()
