import { describe, it, expect } from "vite-plus/test"
import { SailPlatformClient } from "../sail-platform-client"

/** Minimal `Storage` stub — avoids depending on a global `localStorage`. */
function createStorageStub(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    clear: () => data.clear(),
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size
    },
  }
}

type Config = { greeting: string; count: number }

describe("SailPlatformClient", () => {
  it("returns null when nothing is stored", async () => {
    const client = new SailPlatformClient<Config>({ storage: createStorageStub() })

    expect(await client.getConfig()).toBeNull()
  })

  it("round-trips updateConfig/getConfig through the injected storage", async () => {
    const client = new SailPlatformClient<Config>({ storage: createStorageStub() })

    await client.updateConfig({ greeting: "hello", count: 3 })

    expect(await client.getConfig()).toEqual({ greeting: "hello", count: 3 })
  })

  it("writes under `${keyPrefix}config`", async () => {
    const storage = createStorageStub()
    const client = new SailPlatformClient<Config>({ storage, keyPrefix: "custom_" })

    await client.updateConfig({ greeting: "hi", count: 1 })

    expect(storage.getItem("custom_config")).toBe(JSON.stringify({ greeting: "hi", count: 1 }))
  })

  it("defaults the key prefix to sail_", async () => {
    const storage = createStorageStub()
    const client = new SailPlatformClient<Config>({ storage })

    await client.updateConfig({ greeting: "hi", count: 1 })

    expect(storage.getItem("sail_config")).not.toBeNull()
  })
})
