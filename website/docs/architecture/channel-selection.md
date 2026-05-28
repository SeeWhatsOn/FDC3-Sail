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
| Current channel for a tile | `onChannelChanged` → connection store (`channelId`) | Event-driven; matches what the app will see after `userChannelChanged`. |
| Authoritative read from agent | *Not on `SailPlatform` yet* | Prefer `platform.getAppUserChannel(instanceId)` reading agent state (platform-api), not raw DACP impersonation. |

Apps still use **`fdc3.getCurrentChannel()`** inside the iframe over MessagePort — that is the app’s own DACP `getCurrentChannelRequest`.

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

- **`sendDACPMessageOnBehalfOf(instanceId, message: unknown)`** — bypasses WCP validation; allows arbitrary DACP. Deprecated in favor of typed platform channel APIs.
- **Parent calling private `DesktopAgent.handleMessage`** — breaks layering; keep host integration in **platform-api**.
- **Chrome writing agent state without DACP handlers** — breaks conformance and app event delivery.

## Platform API surface (target)

```typescript
// Set — exists today
await platform.changeAppChannel(instanceId, "fdc3.channel.1")
await platform.changeAppChannel(instanceId, null) // leave

// List channels — exists today
const channels = platform.getUserChannels()

// Get current user channel for a tile — add on platform-api (read agent state)
const channelId = platform.getAppUserChannel(instanceId) // planned

// Events — exists today
platform.start({ onChannelChanged: (instanceId, channelId) => { ... } })
```

Low-level **`createSailBrowserDesktopAgent`** remains for advanced hosts; channel chrome should use **`SailPlatform`**, not raw DACP injection.

## Related work

- Transport hardening: `plans/work-items/replace-dacp-impersonation-with-channel-api.md`
- Architecture overview: [Overview](./overview.md) (Sail-controlled UI)
- Platform SDK: [Sail Platform SDK](./sail-platform-sdk.md)
