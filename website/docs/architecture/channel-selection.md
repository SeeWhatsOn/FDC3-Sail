---
sidebar_position: 4
---

# Channel selection: host chrome vs app-hosted UI

FDC3 user channels can be changed in two ways. Sail supports both at the protocol level; **Sail Web uses host-controlled chrome** by default.

## Roles

| Layer | Responsibility |
|-------|----------------|
| **`@finos/sail-desktop-agent`** | FDC3 engine: DACP handlers, agent state, WCP routing, events to apps. Stays **protocol-pure** — no Sail UI, no “chrome” concepts. |
| **`@finos/sail-platform-api`** | Host integration: `SailPlatform`, lifecycle, **channel APIs for parent UI**, WCP connector events, optional `ChannelSelector` callback. |
| **`@finos/sail-web`** (example host) | React chrome (`ChannelSelector`), connection store, tiles around iframes. |

**Principle:** Parent chrome does not mutate Desktop Agent state directly. It calls **platform APIs**; the agent updates state through the same DACP handlers apps use.

## Pattern A — Host-controlled channel UI (Sail default)

**When:** `getChannelSelectorUrl()` returns `false` in WCP3 handshake (Sail-controlled UI).

**Where the UI lives:** Parent window chrome next to each app iframe (one desk, consistent UX).

**Layout:**

```text
┌──────────────────────────────────────────────────────────┐
│  Host (sail-web) — tabs, channel dots, workspace chrome   │
│  ┌────────────────────────────────────────────────────┐  │
│  │  App iframe — FDC3 API + business UI only           │  │
│  │  MessagePort ◄──► WCPConnector ◄──► Desktop Agent    │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Set (join / leave) on behalf of an instance

The host calls **`SailPlatform.changeAppChannel(instanceId, channelId | null)`**:

1. Platform sends a typed **`joinUserChannelRequest`** or **`leaveCurrentChannelRequest`** with `meta.source.instanceId` set to that app.
2. Desktop Agent handlers update `instance.currentUserChannel`.
3. Agent emits **`channelChangedEvent`** toward the app.
4. WCP routes the event and emits **`channelChanged`** on the connector for host UI.

This is “on behalf of the app” in **identity** (source instance id), not “bypass FDC3”.

### Get (read) for chrome

| What chrome needs | API / mechanism today | Notes |
|-------------------|----------------------|--------|
| List of user channels | `platform.getUserChannels()` | Reads agent config / channel registry (not per-app DACP). |
| Current channel for a tile | `platform.getAppUserChannel(instanceId)` | Reads `instance.currentUserChannel` from agent state (no DACP round-trip). |
| Event-driven mirror | `onChannelChanged` → connection store (`channelId`) | Optional; matches what the app receives via `userChannelChanged`. |

Apps still use **`fdc3.getCurrentChannel()`** inside the iframe over MessagePort — that is the app’s own DACP `getCurrentChannelRequest`.

### Host reactivity pattern (push + pull)

Desktop Agent owns channel membership (`AgentState`). Host chrome is a **read-only mirror** updated through public APIs — never by writing agent state directly.

```text
                    ┌─────────────────────────┐
  User picks        │   Desktop Agent (SSOT)   │
  channel in host   │  joinUserChannel handler │
  chrome ──────────►│  updates instance state  │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
   pull: getAppUserChannel(instanceId)    push: channelChanged
   (initial render, connect hook)         (wcpConnector / onChannelChanged)
              │                                   │
              └──────────────► host UI store ◄───┘
```

| Direction | API | Use when |
|-----------|-----|----------|
| **Pull** | `SailPlatform.getAppUserChannel` / `DesktopAgent.getAppUserChannelId` | Component mount, `appConnected`, or after `changeAppChannel` promise resolves |
| **Push** | `wcpConnector.on("channelChanged")` or `SailPlatform.start({ onChannelChanged })` | Any membership change — host-initiated join, app `joinUserChannel`, or leave |

**Sail Web reference:** `packages/sail-web/src/stores/connection-store.ts` wires `channelChanged` into Zustand; `ChannelSelector.tsx` reads `connection.channelId` (not `getState()`). `SailPlatform` itself does not cache channel membership — it forwards events so consumers own UI state.

### Do not use `getState()` for host chrome

`DesktopAgent.getState()` returns the live internal `AgentState` object for **tests and debugging**. Host integrators must not:

- Poll `getState()` on a timer to refresh channel dots
- Mutate fields on the returned object (e.g. `instance.currentUserChannel`)
- Treat `getState()` as a React/subscription source of truth

Use **`getAppUserChannelId` / `getAppUserChannel`** for reads and **`channelChanged`** for updates. Full integrator examples: [Desktop Agent integrator guide — Host channel UI reactivity](../packages/desktop-agent/integrator-guide#host-channel-ui-reactivity-push--pull).

### Listen for updates

| Consumer | Listen to |
|----------|-----------|
| **Host chrome** | `SailPlatform` config `onChannelChanged`, or `wcpConnector.on("channelChanged")`, or a store fed by those events. |
| **App iframe** | `fdc3.addEventListener("userChannelChanged", …)` (FDC3 2.2). |

Both reflect the same agent state change; the host does not need to poke the iframe DOM.

## Pattern B — App-hosted channel selector URL

**When:** `getChannelSelectorUrl(instanceId)` returns a URL (or the app shows its own picker).

**Where the UI lives:** URL loaded in app context (iframe/popup) per FDC3 For-the-Web.

**Flow:**

1. App or selector page sends **`joinUserChannelRequest` / `leaveCurrentChannelRequest`** over the app **MessagePort**.
2. Messages pass **`bridgeTransports`** validation (`isAppMessage`).
3. Same agent handlers and **`channelChangedEvent`** as Pattern A.

**Host chrome** may still listen to `channelChanged` for a global indicator, but it does **not** initiate joins.

## What not to do

- **Raw DACP impersonation** (`sendDACPMessageOnBehalfOf`, private `handleMessage`) — bypasses WCP validation; use typed **`SailPlatform`** channel APIs instead.
- **Chrome writing agent state without DACP handlers** — breaks conformance and app event delivery.

## Platform API surface

```typescript
// Set — join / leave on behalf of an instance
await platform.changeAppChannel(instanceId, "fdc3.channel.1")
await platform.changeAppChannel(instanceId, null) // leave

// List channels
const channels = platform.getUserChannels()

// Get current user channel for a tile (read agent state)
const channelId = platform.getAppUserChannel(instanceId)

// Events — optional mirror for UI stores
platform.start({ onChannelChanged: (instanceId, channelId) => { ... } })
```

Low-level **`createSailBrowserDesktopAgent`** (returns a `DesktopAgent`) remains for advanced hosts; channel chrome should use **`SailPlatform`**, not raw DACP injection.

## Related work

- Transport hardening: `plans/work-items/replace-dacp-impersonation-with-channel-api.md`
- Architecture overview: [Overview](./overview.md) (Sail-controlled UI)
- Platform API: [@finos/sail-platform-api](../packages/platform-api/overview)
