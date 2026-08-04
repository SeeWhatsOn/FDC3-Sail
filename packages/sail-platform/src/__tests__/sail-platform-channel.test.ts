import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test"
import type { DesktopAgent } from "@finos/sail-desktop-agent"
import { SailPlatform } from "../sail-platform"
import { createSailBrowserDesktopAgent } from "../sail-browser-desktop-agent"

const INSTANCE_ID = "test-instance-1"
const CHANNEL_ID = "fdc3.channel.1"

type MutableAgentState = {
  instances: Record<
    string,
    {
      instanceId: string
      currentUserChannel: string | null
      [key: string]: unknown
    }
  >
}

function agentState(agent: DesktopAgent): MutableAgentState {
  return (agent as unknown as { state: MutableAgentState }).state
}

function seedConnectedInstance(agent: DesktopAgent, instanceId: string = INSTANCE_ID): void {
  const now = new Date()
  const state = agentState(agent)
  state.instances = {
    ...state.instances,
    [instanceId]: {
      instanceId,
      appId: "test-app",
      metadata: { appId: "test-app", name: "Test App", version: "1.0.0", title: "Test" },
      state: "connected",
      createdAt: now,
      lastActivity: now,
      currentUserChannel: null,
      contextListeners: {},
      intentListeners: [],
      privateChannels: [],
    },
  }
}

/** Mirrors agent state after DACP join/leave handlers run (no WCP event round-trip). */
function setInstanceUserChannel(
  agent: DesktopAgent,
  instanceId: string,
  channelId: string | null,
): void {
  const instance = agentState(agent).instances[instanceId]
  if (instance) {
    instance.currentUserChannel = channelId
  }
}

function createTestPlatform(): SailPlatform {
  return new SailPlatform({
    appLauncher: {
      launch: vi.fn(() => Promise.resolve({ appId: "test-app", instanceId: INSTANCE_ID })),
    },
  })
}

describe("SailPlatform channel APIs", () => {
  let platform: SailPlatform

  beforeEach(() => {
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    platform = createTestPlatform()
  })

  afterEach(() => {
    platform.stop()
    vi.unstubAllGlobals()
  })

  describe("channels.getAppChannelId", () => {
    it("throws when platform is not started", () => {
      expect(() => platform.channels).toThrow(/not started/i)
    })

    it("returns null for unknown instance", () => {
      platform.start()
      expect(platform.channels.getAppChannelId("unknown-instance")).toBeNull()
    })

    it("returns null when instance has no channel", () => {
      platform.start()
      seedConnectedInstance(platform.agent)
      expect(platform.channels.getAppChannelId(INSTANCE_ID)).toBeNull()
    })

    it("returns current channel after instance joins a user channel", () => {
      platform.start()
      seedConnectedInstance(platform.agent)
      setInstanceUserChannel(platform.agent, INSTANCE_ID, CHANNEL_ID)

      expect(platform.channels.getAppChannelId(INSTANCE_ID)).toBe(CHANNEL_ID)
    })

    it("returns null after instance leaves its user channel", () => {
      platform.start()
      seedConnectedInstance(platform.agent)
      setInstanceUserChannel(platform.agent, INSTANCE_ID, CHANNEL_ID)
      setInstanceUserChannel(platform.agent, INSTANCE_ID, null)

      expect(platform.channels.getAppChannelId(INSTANCE_ID)).toBeNull()
    })
  })

  describe("channels.changeAppChannel", () => {
    it("throws when platform is not started", () => {
      expect(() => platform.channels).toThrow(/not started/i)
    })

    it("throws when channel does not exist", async () => {
      platform.start()
      seedConnectedInstance(platform.agent)

      await expect(
        platform.channels.changeAppChannel(INSTANCE_ID, "nonexistent-channel"),
      ).rejects.toThrow(/does not exist/i)
    })

    it("joins channel and getAppChannelId returns the updated channel id", async () => {
      platform.start()
      seedConnectedInstance(platform.agent)

      await platform.channels.changeAppChannel(INSTANCE_ID, CHANNEL_ID)

      expect(platform.channels.getAppChannelId(INSTANCE_ID)).toBe(CHANNEL_ID)
    })

    it("leaves channel and getAppChannelId returns null", async () => {
      platform.start()
      seedConnectedInstance(platform.agent)

      await platform.channels.changeAppChannel(INSTANCE_ID, CHANNEL_ID)
      await platform.channels.changeAppChannel(INSTANCE_ID, null)

      expect(platform.channels.getAppChannelId(INSTANCE_ID)).toBeNull()
    })
  })
})

describe("createSailBrowserDesktopAgent", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("does not expose sendDACPMessageOnBehalfOf", () => {
    const result = createSailBrowserDesktopAgent()

    expect("sendDACPMessageOnBehalfOf" in result).toBe(false)
  })
})
