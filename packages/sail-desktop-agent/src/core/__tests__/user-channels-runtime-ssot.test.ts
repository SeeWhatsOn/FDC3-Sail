import { describe, expect, it } from "vitest"
import type { BrowserTypes } from "@finos/fdc3"
import { DesktopAgent } from "../desktop-agent"
import { DEFAULT_FDC3_USER_CHANNELS } from "../default-user-channels"
import { handleGetUserChannelsRequest } from "../handlers/dacp/channel-handlers"
import {
  createDACPTestContext,
  createDacpRequestMeta,
} from "../handlers/dacp/__tests__/test-context"
import { getAllUserChannels } from "../state/selectors"

const CUSTOM_USER_CHANNELS: BrowserTypes.Channel[] = [
  {
    id: "custom.channel.a",
    type: "user",
    displayMetadata: { name: "Custom A", color: "#111111" },
  },
  {
    id: "custom.channel.b",
    type: "user",
    displayMetadata: { name: "Custom B", color: "#222222" },
  },
]

describe("user channels runtime SSOT", () => {
  it("seeds configured user channels into state.channels.user at construction", () => {
    const agent = new DesktopAgent({ userChannels: CUSTOM_USER_CHANNELS })

    const stateChannels = getAllUserChannels(agent.getState())
    expect(stateChannels).toEqual(CUSTOM_USER_CHANNELS)
    expect(Object.keys(agent.getState().channels.user).sort()).toEqual([
      "custom.channel.a",
      "custom.channel.b",
    ])
  })

  it("getUserChannels reads from state via selectors, not a separate config field", () => {
    const agent = new DesktopAgent({ userChannels: CUSTOM_USER_CHANNELS })

    expect(agent.getUserChannels()).toEqual(getAllUserChannels(agent.getState()))

    agent.getState().channels.user["runtime.added"] = {
      id: "runtime.added",
      type: "user",
      displayMetadata: { name: "Runtime Added", color: "#333333" },
    }

    expect(agent.getUserChannels()).toEqual(getAllUserChannels(agent.getState()))
    expect(agent.getUserChannels().map(channel => channel.id)).toContain("runtime.added")
  })

  it("defaults to DEFAULT_FDC3_USER_CHANNELS in state when config is omitted", () => {
    const agent = new DesktopAgent({})

    expect(getAllUserChannels(agent.getState())).toEqual(DEFAULT_FDC3_USER_CHANNELS)
    expect(agent.getUserChannels()).toEqual(DEFAULT_FDC3_USER_CHANNELS)
  })

  it("handleGetUserChannelsRequest returns channels from agent state", () => {
    const { context, getState } = createDACPTestContext({
      instanceId: "a1",
      initialState: undefined,
    })

    getState().channels.user = Object.fromEntries(
      CUSTOM_USER_CHANNELS.map(channel => [channel.id, channel])
    )

    const sent: unknown[] = []
    context.transport.send = message => {
      sent.push(message)
    }

    handleGetUserChannelsRequest(
      {
        type: "getUserChannelsRequest",
        payload: {},
        meta: createDacpRequestMeta("req-1"),
      },
      context
    )

    expect(sent).toHaveLength(1)
    const response = sent[0] as {
      type: string
      payload: { userChannels: BrowserTypes.Channel[] }
    }
    expect(response.type).toBe("getUserChannelsResponse")
    expect(response.payload.userChannels).toEqual(CUSTOM_USER_CHANNELS)
  })
})
