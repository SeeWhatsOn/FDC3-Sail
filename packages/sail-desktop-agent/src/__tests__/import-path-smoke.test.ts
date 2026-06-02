/**
 * Smoke test: reorganized runtime folders resolve via package entrypoints.
 */
import { describe, expect, it } from "vitest"

describe("reorganized import paths", () => {
  it("resolves DACP protocol modules from protocols/dacp", async () => {
    const dacp = await import("../protocols/dacp/index.js")
    expect(dacp.DACP_TIMEOUTS).toBeDefined()
    expect(dacp.createDACPSuccessResponse).toBeTypeOf("function")
    expect(dacp.logDACPMessage).toBeTypeOf("function")
  })

  it("resolves WCP protocol modules from protocols/wcp", async () => {
    const wcp = await import("../protocols/wcp/index.js")
    expect(wcp.isDACPMessage).toBeTypeOf("function")
    expect(wcp.handleWCP1Hello).toBeTypeOf("function")
    expect(wcp.bridgeTransports).toBeTypeOf("function")
  })

  it("resolves browser connector wiring from connectors/browser", async () => {
    const browser = await import("../connectors/browser/index.js")
    expect(browser.WCPConnector).toBeTypeOf("function")
    expect(browser.MessagePortTransport).toBeTypeOf("function")
    expect(browser.createBrowserDesktopAgent).toBeTypeOf("function")
  })

  it("re-exports DACP protocol from core entry for backward-compatible imports", async () => {
    const core = await import("../core/index.js")
    expect(core.DACP_TIMEOUTS).toBeDefined()
    expect(core.createDACPSuccessResponse).toBeTypeOf("function")
  })
})
