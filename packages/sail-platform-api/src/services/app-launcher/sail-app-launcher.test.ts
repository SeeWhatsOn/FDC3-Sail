import { describe, expect, it, vi } from "vite-plus/test"

import { SailAppLauncher } from "./sail-app-launcher"

describe("SailAppLauncher", () => {
  it("calls onLaunchApp on launch", async () => {
    const onLaunchApp = vi.fn().mockResolvedValue(undefined)
    const launcher = new SailAppLauncher({ onLaunchApp })

    const result = await launcher.launch({ app: { appId: "demo-app" } }, {
      appId: "demo-app",
      name: "Demo",
      type: "web",
      details: { url: "https://example.com/demo" },
    } as never)

    expect(result.appId).toBe("demo-app")
    expect(onLaunchApp).toHaveBeenCalledWith(
      expect.objectContaining({ appId: "demo-app" }),
      result.instanceId,
      undefined,
    )
  })

  it("calls onCloseApp from close()", async () => {
    const onCloseApp = vi.fn().mockResolvedValue(undefined)
    const launcher = new SailAppLauncher({
      onLaunchApp: vi.fn().mockResolvedValue(undefined),
      onCloseApp,
    })

    await launcher.close("instance-1")

    expect(onCloseApp).toHaveBeenCalledWith("instance-1")
  })

  it("rejects close when onCloseApp is not configured", async () => {
    const launcher = new SailAppLauncher({
      onLaunchApp: vi.fn().mockResolvedValue(undefined),
    })

    await expect(launcher.close("instance-1")).rejects.toThrow(/onCloseApp/)
  })
})
