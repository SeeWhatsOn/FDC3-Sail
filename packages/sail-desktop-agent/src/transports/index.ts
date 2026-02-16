/**
 * Transport Implementations
 *
 * This module exports various Transport implementations for different
 * communication scenarios.
 *
 * ## Available Transports
 *
 * - **InMemoryTransport** - For same-process communication (any environment)
 *
 * ## Tree-Shaking
 *
 * Each transport can be imported individually to minimize bundle size:
 *
 * ```typescript
 * // ✅ Only InMemoryTransport included
 * import { createInMemoryTransportPair } from '@finos/fdc3-sail-desktop-agent/transports'
 *
 * // ❌ Avoid importing from root package for transports
 * import { InMemoryTransport } from '@finos/fdc3-sail-desktop-agent'
 * ```
 *
 * ## Usage
 *
 * ### InMemoryTransport (Browser Desktop Agent)
 * ```typescript
 * import { createInMemoryTransportPair } from '@finos/fdc3-sail-desktop-agent/transports'
 * import { DesktopAgent } from '@finos/fdc3-sail-desktop-agent'
 * import { WCPConnector } from '@finos/fdc3-sail-desktop-agent/browser'
 *
 * // Create linked transports
 * const [daTransport, wcpTransport] = createInMemoryTransportPair()
 *
 * // Desktop Agent uses one
 * const da = new DesktopAgent({ transport: daTransport })
 *
 * // WCP Connector uses the other
 * const wcp = new WCPConnector(wcpTransport)
 * ```
 *
 * ## Environment-Specific Transports
 *
 * Some transports are environment-specific and live in other packages:
 *
 * - **SocketIOTransport** - In `@finos/fdc3-sail-api/transports` (Node.js/browser)
 * - **WorkerTransport** - Future implementation for SharedWorker
 */

export { InMemoryTransport, createInMemoryTransportPair } from "./in-memory-transport"
