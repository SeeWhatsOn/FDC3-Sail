/**
 * CHARACTERIZATION tests for the instance id that reaches a DACP handler during the WCP
 * handshake window.
 *
 * `DACPHandlerContext.instanceId` is stamped from the wire. In the handshake window the wire id
 * (`temp-<uuid>` or a not-yet-registered MessagePort id) is NOT the validated WCP5 instance id, and
 * handler bodies disagree about what to do with it:
 *
 *   - Some destructure it raw            — private-channels, channels, open, intent-discovery,
 *                                          `handleAddEventListenerRequest`, `handleAddIntentListener`
 *   - Some call `resolveDacpHandlerInstanceId` — broadcast, `handleEventListenerUnsubscribeRequest`,
 *                                          `handleIntentListenerUnsubscribe`
 *
 * These tests assert what the code does TODAY, not what it should do. Every assertion that pins
 * behaviour an upcoming change is expected to alter carries a `// CHARACTERIZATION:` comment.
 * When resolution moves to the context-construction sites, the failing set here is exactly the
 * behavioural delta.
 */
import { afterEach, describe, expect, it } from "vite-plus/test"
import { ChannelError, ResolveError } from "@finos/fdc3"

import { MockTransport } from "../../__tests__/utils/mock-transport"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../agent/default-user-channels"
import { createInitialState } from "../../state/initial-state"
import {
  addApp,
  addPrivateChannelAddContextListenerListener,
  connectInstance,
  createPrivateChannel,
  joinUserChannel,
  registerIntentListener,
  updateInstanceState,
} from "../../state/mutators"
import { linkHandshakeRoutingId } from "../../state/mutators/wcp-handshake-routing"
import { getEventListener, getIntentListener, getPrivateChannel } from "../../state/selectors"
import { AppInstanceState, type AgentState } from "../../state/types"
import { clearAllHeartbeatTimersForTesting } from "../heartbeat/runtime"
import { clearAllPendingOpenWithContextTimeoutsForTesting } from "../utils/open-with-context"
import {
  createDACPTestContext,
  createDacpRequestMeta,
  withResponseDispatcher,
} from "./test-context"
import { handleAddContextListener } from "../broadcast/handlers"
import { handleGetCurrentChannelRequest, handleJoinUserChannelRequest } from "../channels/handlers"
import {
  handleAddEventListenerRequest,
  handleEventListenerUnsubscribeRequest,
} from "../events/handlers"
import { handleFindIntentRequest } from "../intents/intent-discovery-handlers"
import {
  handleAddIntentListener,
  handleIntentListenerUnsubscribe,
} from "../intents/intent-listener-handlers"
import { handleGetInfoRequest } from "../open/handlers"
import {
  handleCreatePrivateChannelRequest,
  handlePrivateChannelAddContextListenerRequest,
  handlePrivateChannelDisconnectRequest,
  handlePrivateChannelUnsubscribeEventListenerRequest,
} from "../private-channels/handlers"

/** The validated WCP5 instance — registered in `state.instances`, connected. */
const VALIDATED_ID = "validated-wcp5-instance"
const APP_ID = "ChartApp"
/** Pre-WCP5 routing id, linked to VALIDATED_ID by `linkHandshakeRoutingId`. */
const HANDSHAKE_ROUTING_ID = "temp-handshake-window"
/** A MessagePort id that was never registered and was never linked to anything. */
const UNREGISTERED_PORT_ID = "port-never-registered"
const PRIVATE_CHANNEL_ID = "private-channel-1"
const JOINED_CHANNEL_ID = "fdc3.channel.1"
const OTHER_CHANNEL_ID = "fdc3.channel.2"
const INTENT_NAME = "ViewChart"

type WireMessage = {
  type: string
  meta?: { destination?: { instanceId?: string } }
  payload?: {
    error?: string
    listenerUUID?: string
    channel?: unknown
    implementationMetadata?: { appMetadata?: unknown }
  }
}

afterEach(() => {
  clearAllHeartbeatTimersForTesting()
  clearAllPendingOpenWithContextTimeoutsForTesting()
})

/**
 * The handshake window: VALIDATED_ID is the registered, connected instance; HANDSHAKE_ROUTING_ID is
 * linked to it via WCP5 handshake routing but is itself unregistered.
 */
function handshakeWindowState(): AgentState {
  let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
  state = connectInstance(state, {
    instanceId: VALIDATED_ID,
    appId: APP_ID,
    metadata: { name: APP_ID },
  })
  state = updateInstanceState(state, VALIDATED_ID, AppInstanceState.CONNECTED)
  state = linkHandshakeRoutingId(state, HANDSHAKE_ROUTING_ID, VALIDATED_ID)
  return state
}

/** A handler context stamped with `instanceId`, sharing `state` and one recording transport. */
function contextFor(instanceId: string, state: AgentState, transport: MockTransport) {
  const { context, getState } = createDACPTestContext({ instanceId, initialState: state })
  return { context: withResponseDispatcher(context, transport), getState }
}

function lastMessage(transport: MockTransport): WireMessage {
  const messages = transport.sentMessages as WireMessage[]
  const last = messages[messages.length - 1]
  if (!last) {
    throw new Error("Expected at least one message on the transport")
  }
  return last
}

describe("private-channels handlers: instance id in the WCP handshake window", () => {
  it("fails createPrivateChannelRequest under a linked temp- id instead of creating a channel for the linked instance", () => {
    const transport = new MockTransport()
    const { context, getState } = contextFor(
      HANDSHAKE_ROUTING_ID,
      handshakeWindowState(),
      transport,
    )

    handleCreatePrivateChannelRequest(
      {
        type: "createPrivateChannelRequest",
        meta: createDacpRequestMeta("create-private-temp", {
          appId: APP_ID,
          instanceId: HANDSHAKE_ROUTING_ID,
        }),
        payload: {},
      },
      context,
    )

    const response = lastMessage(transport)
    expect(response.type).toBe("createPrivateChannelResponse")
    // CHARACTERIZATION: the handler reads the raw wire id, so `getInstance` misses and creation
    // fails even though the linked instance IS registered. Resolving at the entry point would
    // create the channel for VALIDATED_ID instead.
    expect(response.payload?.error).toBe(ChannelError.CreationFailed)
    expect(Object.keys(getState().channels.private)).toHaveLength(0)
  })

  it("denies a linked temp- id access to the linked instance's private channel on addEventListener", () => {
    const transport = new MockTransport()
    const state = createPrivateChannel(
      handshakeWindowState(),
      PRIVATE_CHANNEL_ID,
      APP_ID,
      VALIDATED_ID,
    )
    const { context, getState } = contextFor(HANDSHAKE_ROUTING_ID, state, transport)

    handlePrivateChannelAddContextListenerRequest(
      {
        type: "privateChannelAddEventListenerRequest",
        meta: createDacpRequestMeta("private-add-listener-temp", {
          appId: APP_ID,
          instanceId: HANDSHAKE_ROUTING_ID,
        }),
        payload: { privateChannelId: PRIVATE_CHANNEL_ID, listenerType: "addContextListener" },
      },
      context,
    )

    const response = lastMessage(transport)
    expect(response.type).toBe("privateChannelAddEventListenerResponse")
    // CHARACTERIZATION: `connectedInstances.includes(instanceId)` is an ACCESS-CONTROL check and it
    // is evaluated against the raw wire id today. The linked temp- id is denied. Resolving at the
    // entry point would GRANT it — the linked instance is a member.
    expect(response.payload?.error).toBe(ChannelError.AccessDenied)
    expect(
      Object.keys(getPrivateChannel(getState(), PRIVATE_CHANNEL_ID)!.addContextListenerListeners),
    ).toHaveLength(0)
  })

  it("denies a linked temp- id on privateChannelDisconnectRequest and leaves the linked instance connected", () => {
    const transport = new MockTransport()
    const state = createPrivateChannel(
      handshakeWindowState(),
      PRIVATE_CHANNEL_ID,
      APP_ID,
      VALIDATED_ID,
    )
    const { context, getState } = contextFor(HANDSHAKE_ROUTING_ID, state, transport)

    handlePrivateChannelDisconnectRequest(
      {
        type: "privateChannelDisconnectRequest",
        meta: createDacpRequestMeta("private-disconnect-temp", {
          appId: APP_ID,
          instanceId: HANDSHAKE_ROUTING_ID,
        }),
        payload: { channelId: PRIVATE_CHANNEL_ID },
      },
      context,
    )

    const response = lastMessage(transport)
    expect(response.type).toBe("privateChannelDisconnectResponse")
    // CHARACTERIZATION: same raw-id membership gate. Resolving would let the handshake-window id
    // disconnect VALIDATED_ID from the channel.
    expect(response.payload?.error).toBe(ChannelError.AccessDenied)
    expect(getPrivateChannel(getState(), PRIVATE_CHANNEL_ID)?.connectedInstances).toContain(
      VALIDATED_ID,
    )
  })

  it("denies a linked temp- id unsubscribing the linked instance's private channel listener", () => {
    const transport = new MockTransport()
    const listenerUUID = "private-listener-owned-by-validated"
    let state = createPrivateChannel(
      handshakeWindowState(),
      PRIVATE_CHANNEL_ID,
      APP_ID,
      VALIDATED_ID,
    )
    state = addPrivateChannelAddContextListenerListener(
      state,
      PRIVATE_CHANNEL_ID,
      listenerUUID,
      VALIDATED_ID,
    )
    const { context, getState } = contextFor(HANDSHAKE_ROUTING_ID, state, transport)

    handlePrivateChannelUnsubscribeEventListenerRequest(
      {
        type: "privateChannelUnsubscribeEventListenerRequest",
        meta: createDacpRequestMeta("private-unsub-temp", {
          appId: APP_ID,
          instanceId: HANDSHAKE_ROUTING_ID,
        }),
        payload: { listenerUUID },
      },
      context,
    )

    const response = lastMessage(transport)
    expect(response.type).toBe("privateChannelUnsubscribeEventListenerResponse")
    // CHARACTERIZATION: ownership is compared against the raw wire id, unlike the sibling
    // event/intent unsubscribe handlers which resolve first.
    expect(response.payload?.error).toBe(ChannelError.InvalidArguments)
    expect(
      getPrivateChannel(getState(), PRIVATE_CHANNEL_ID)?.addContextListenerListeners[listenerUUID],
    ).toBeDefined()
  })

  it("denies an unregistered, unlinked MessagePort id the same way as a linked temp- id", () => {
    const transport = new MockTransport()
    const state = createPrivateChannel(
      handshakeWindowState(),
      PRIVATE_CHANNEL_ID,
      APP_ID,
      VALIDATED_ID,
    )
    const { context, getState } = contextFor(UNREGISTERED_PORT_ID, state, transport)

    handlePrivateChannelAddContextListenerRequest(
      {
        type: "privateChannelAddEventListenerRequest",
        meta: createDacpRequestMeta("private-add-listener-unlinked", {
          appId: APP_ID,
          instanceId: UNREGISTERED_PORT_ID,
        }),
        payload: { privateChannelId: PRIVATE_CHANNEL_ID, listenerType: "addContextListener" },
      },
      context,
    )

    // Stable across the refactor: with no registration and no handshake link, both resolvers
    // return the input unchanged, so raw and resolved ids agree.
    expect(lastMessage(transport).payload?.error).toBe(ChannelError.AccessDenied)
    expect(
      Object.keys(getPrivateChannel(getState(), PRIVATE_CHANNEL_ID)!.addContextListenerListeners),
    ).toHaveLength(0)
  })
})

describe("channels handlers: instance id in the WCP handshake window", () => {
  it("reports no current channel for a linked temp- id even though the linked instance is on one", () => {
    const transport = new MockTransport()
    const state = joinUserChannel(handshakeWindowState(), VALIDATED_ID, JOINED_CHANNEL_ID)
    const { context } = contextFor(HANDSHAKE_ROUTING_ID, state, transport)

    handleGetCurrentChannelRequest(
      {
        type: "getCurrentChannelRequest",
        meta: createDacpRequestMeta("get-current-channel-temp", {
          appId: APP_ID,
          instanceId: HANDSHAKE_ROUTING_ID,
        }),
        payload: {},
      },
      context,
    )

    const response = lastMessage(transport)
    expect(response.type).toBe("getCurrentChannelResponse")
    // CHARACTERIZATION: raw wire id -> no instance -> `channel: null`. Resolving would report
    // JOINED_CHANNEL_ID.
    expect(response.payload?.channel).toBeNull()
  })

  it("acknowledges joinUserChannelRequest for a linked temp- id without moving the linked instance", () => {
    const transport = new MockTransport()
    const state = joinUserChannel(handshakeWindowState(), VALIDATED_ID, JOINED_CHANNEL_ID)
    const { context, getState } = contextFor(HANDSHAKE_ROUTING_ID, state, transport)

    handleJoinUserChannelRequest(
      {
        type: "joinUserChannelRequest",
        meta: createDacpRequestMeta("join-channel-temp", {
          appId: APP_ID,
          instanceId: HANDSHAKE_ROUTING_ID,
        }),
        payload: { channelId: OTHER_CHANNEL_ID },
      },
      context,
    )

    const response = lastMessage(transport)
    expect(response.type).toBe("joinUserChannelResponse")
    // CHARACTERIZATION: the app is told the join succeeded, but `joinUserChannel` no-ops on the
    // unregistered raw id, so the linked instance never moves. Resolving would move it.
    expect(response.payload?.error).toBeUndefined()
    expect(getState().instances[VALIDATED_ID]?.currentUserChannel).toBe(JOINED_CHANNEL_ID)
  })
})

describe("open handlers: instance id in the WCP handshake window", () => {
  it("omits appMetadata from getInfoResponse for a linked temp- id", () => {
    const transport = new MockTransport()
    const { context } = contextFor(HANDSHAKE_ROUTING_ID, handshakeWindowState(), transport)

    handleGetInfoRequest(
      {
        type: "getInfoRequest",
        meta: createDacpRequestMeta("get-info-temp", {
          appId: APP_ID,
          instanceId: HANDSHAKE_ROUTING_ID,
        }),
        payload: {},
      },
      context,
    )

    const response = lastMessage(transport)
    expect(response.type).toBe("getInfoResponse")
    // CHARACTERIZATION: raw wire id -> no caller instance -> no appMetadata block at all.
    // Resolving would populate it with VALIDATED_ID.
    expect(response.payload?.implementationMetadata?.appMetadata).toBeUndefined()
  })
})

describe("intent-discovery handlers: instance id in the WCP handshake window", () => {
  it("routes findIntentResponse back to the raw temp- id, not the linked instance", () => {
    const transport = new MockTransport()
    const state = addApp(handshakeWindowState(), {
      appId: APP_ID,
      title: APP_ID,
      type: "web",
      details: { url: "https://example.com/chart" },
      interop: {
        intents: {
          listensFor: {
            [INTENT_NAME]: { displayName: INTENT_NAME, contexts: ["fdc3.instrument"] },
          },
        },
      },
    })
    const { context } = contextFor(HANDSHAKE_ROUTING_ID, state, transport)

    handleFindIntentRequest(
      {
        type: "findIntentRequest",
        meta: createDacpRequestMeta("find-intent-temp", {
          appId: APP_ID,
          instanceId: HANDSHAKE_ROUTING_ID,
        }),
        payload: { intent: INTENT_NAME },
      },
      context,
    )

    const response = lastMessage(transport)
    expect(response.type).toBe("findIntentResponse")
    expect(response.payload?.error).toBeUndefined()
    // CHARACTERIZATION: intent-discovery uses the id only for response routing, and routes to the
    // raw wire id. Resolving would address the response to VALIDATED_ID.
    expect(response.meta?.destination?.instanceId).toBe(HANDSHAKE_ROUTING_ID)
  })
})

describe("intent-listener handlers: add trusts the raw id, unsubscribe resolves it", () => {
  it("rejects addIntentListenerRequest under a linked temp- id and registers nothing", () => {
    const transport = new MockTransport()
    const { context, getState } = contextFor(
      HANDSHAKE_ROUTING_ID,
      handshakeWindowState(),
      transport,
    )

    handleAddIntentListener(
      {
        type: "addIntentListenerRequest",
        meta: createDacpRequestMeta("add-intent-listener-temp", {
          appId: APP_ID,
          instanceId: HANDSHAKE_ROUTING_ID,
        }),
        payload: { intent: INTENT_NAME },
      },
      context,
    )

    const response = lastMessage(transport)
    expect(response.type).toBe("addIntentListenerResponse")
    // CHARACTERIZATION: `handleAddIntentListener` reads `context.instanceId` raw (line 47), so the
    // handshake-window id is unknown. Its sibling unsubscribe resolves — see the next test.
    expect(response.payload?.error).toBe(ResolveError.TargetInstanceUnavailable)
    expect(Object.keys(getState().intents.listeners)).toHaveLength(0)
  })

  it("lets a linked temp- id unsubscribe the linked instance's intent listener", () => {
    const transport = new MockTransport()
    const listenerUUID = "intent-listener-owned-by-validated"
    const state = registerIntentListener(handshakeWindowState(), {
      listenerId: listenerUUID,
      intentName: INTENT_NAME,
      instanceId: VALIDATED_ID,
      appId: APP_ID,
      contextTypes: [],
    })
    const { context, getState } = contextFor(HANDSHAKE_ROUTING_ID, state, transport)

    handleIntentListenerUnsubscribe(
      {
        type: "intentListenerUnsubscribeRequest",
        meta: createDacpRequestMeta("intent-unsub-temp", {
          appId: APP_ID,
          instanceId: HANDSHAKE_ROUTING_ID,
        }),
        payload: { listenerUUID },
      },
      context,
    )

    const response = lastMessage(transport)
    expect(response.type).toBe("intentListenerUnsubscribeResponse")
    // Already resolved today (`resolveDacpHandlerInstanceId` at line 125): the ownership check
    // compares against VALIDATED_ID, so the removal succeeds. Expected to stay green.
    expect(response.payload?.error).toBeUndefined()
    expect(getIntentListener(getState(), listenerUUID)).toBeUndefined()
  })
})

describe("events handlers: add trusts the raw id, unsubscribe resolves it", () => {
  it("rejects addEventListenerRequest under a linked temp- id and registers nothing", () => {
    const transport = new MockTransport()
    const { context, getState } = contextFor(
      HANDSHAKE_ROUTING_ID,
      handshakeWindowState(),
      transport,
    )

    handleAddEventListenerRequest(
      {
        type: "addEventListenerRequest",
        meta: createDacpRequestMeta("add-event-listener-temp", {
          appId: APP_ID,
          instanceId: HANDSHAKE_ROUTING_ID,
        }),
        payload: { type: "USER_CHANNEL_CHANGED" },
      },
      context,
    )

    const response = lastMessage(transport)
    expect(response.type).toBe("addEventListenerResponse")
    // CHARACTERIZATION: raw wire id (line 26). Its sibling unsubscribe resolves — next test.
    expect(response.payload?.error).toBe(ChannelError.InvalidArguments)
    expect(Object.keys(getState().events.listeners)).toHaveLength(0)
  })

  it("lets a linked temp- id unsubscribe the linked instance's event listener", () => {
    const transport = new MockTransport()
    const { context: validatedContext } = contextFor(
      VALIDATED_ID,
      handshakeWindowState(),
      transport,
    )

    handleAddEventListenerRequest(
      {
        type: "addEventListenerRequest",
        meta: createDacpRequestMeta("add-event-listener-validated", {
          appId: APP_ID,
          instanceId: VALIDATED_ID,
        }),
        payload: { type: "USER_CHANNEL_CHANGED" },
      },
      validatedContext,
    )
    const listenerUUID = lastMessage(transport).payload?.listenerUUID
    expect(listenerUUID).toBeDefined()

    const { context: handshakeContext, getState } = contextFor(
      HANDSHAKE_ROUTING_ID,
      validatedContext.getState(),
      transport,
    )

    handleEventListenerUnsubscribeRequest(
      {
        type: "eventListenerUnsubscribeRequest",
        meta: createDacpRequestMeta("event-unsub-temp", {
          appId: APP_ID,
          instanceId: HANDSHAKE_ROUTING_ID,
        }),
        payload: { listenerUUID: listenerUUID! },
      },
      handshakeContext,
    )

    const response = lastMessage(transport)
    expect(response.type).toBe("eventListenerUnsubscribeResponse")
    // Already resolved today (`resolveDacpHandlerInstanceId` at line 103). Expected to stay green.
    expect(response.payload?.error).toBeUndefined()
    expect(getEventListener(getState(), listenerUUID!)).toBeUndefined()
  })
})

describe("broadcast handlers: instance id in the WCP handshake window", () => {
  it("registers a context listener from a linked temp- id against the linked instance", () => {
    const transport = new MockTransport()
    const requestUuid = "add-context-listener-temp"
    const { context, getState } = contextFor(
      HANDSHAKE_ROUTING_ID,
      handshakeWindowState(),
      transport,
    )

    handleAddContextListener(
      {
        type: "addContextListenerRequest",
        meta: createDacpRequestMeta(requestUuid, {
          appId: APP_ID,
          instanceId: HANDSHAKE_ROUTING_ID,
        }),
        payload: { channelId: null, contextType: "fdc3.instrument" },
      },
      context,
    )

    const response = lastMessage(transport)
    expect(response.type).toBe("addContextListenerResponse")
    expect(response.payload?.error).toBeUndefined()
    // Already resolved today (`resolveDacpHandlerInstanceId` at line 164): the listener lands on
    // VALIDATED_ID, not on the wire id. Expected to stay green.
    expect(getState().instances[VALIDATED_ID]?.contextListeners[requestUuid]).toBeDefined()
    expect(getState().instances[HANDSHAKE_ROUTING_ID]).toBeUndefined()
  })
})
