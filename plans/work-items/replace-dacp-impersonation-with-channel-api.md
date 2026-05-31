---
title: "Replace sendDACPMessageOnBehalfOf with intention-level channel API"
slug: replace-dacp-impersonation-with-channel-api
kind: task
type: feature
status: pr_awaiting
branch: cursor/replace-dacp-impersonation-f2c8
pr_url: https://github.com/SeeWhatsOn/FDC3-Sail/pull/40
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-platform-api/src/sail-platform.ts
  - packages/sail-platform-api/src/sail-browser-desktop-agent.ts
  - packages/sail-platform-api/src/index.ts
  - packages/sail-platform-api/README.md
  - website/docs/architecture/channel-selection.md
  - packages/sail-desktop-agent/src/browser/wcp/wcp-message-routing.ts
depends_on: []
integration_branch: ""
branch: feature/platform-channel-api-no-impersonation
external_tracker: ""
tags: [api, fdc3, security]
---

## Goal

Host chrome **set/get** for per-app user channels lives in **`@finos/sail-platform-api`** only. Remove public raw DACP impersonation; keep **`@finos/sail-desktop-agent`** protocol-pure (handlers + WCP, no Sail UI).

## User or system context

### Layering (human decision 2026-05-27)

| Layer | Channel chrome responsibility |
|-------|------------------------------|
| **sail-web** | Renders `ChannelSelector`; calls platform APIs |
| **sail-platform-api** | `changeAppChannel`, `getUserChannels`, **`getAppUserChannel`** (add), `onChannelChanged`; typed join/leave dispatch |
| **sail-desktop-agent** | DACP handlers, state, events — **no** “on behalf of” public escape hatch |

### Set / get today

- **Set:** `SailPlatform.changeAppChannel(instanceId, channelId \| null)` — yes; typed join/leave toward DA.
- **Get list:** `getUserChannels()` — yes.
- **Get per instance:** sail-web uses **connection store** updated from `channelChanged` events — works but platform should expose **`getAppUserChannel(instanceId)`** reading agent state (no DACP round-trip, no impersonation).
- **App iframe get:** app calls `fdc3.getCurrentChannel()` over MessagePort — unchanged.

### Anti-pattern

`sendDACPMessageOnBehalfOf(instanceId, unknown)` on `createSailBrowserDesktopAgent` — unused in repo; bypasses WCP. Remove or restrict to internal platform use replaced by typed APIs.

## Reference docs

- `website/docs/architecture/channel-selection.md` (Pattern A vs B — maintain with this work)
- `plans/prd-transport-platform-hardening.md`
- `plans/project-docs.md`

## Parent context

Transport/platform hardening: authority-safe host integration. FDC3 allows host-owned channel UI when `channelSelectorUrl: false`; implementation belongs in platform-api, not desktop-agent public surface.

## Parent context

From `plans/prd-transport-platform-hardening.md`: Harden InMemory/MessagePort transports and replace platform DACP impersonation for reliable disconnect and authority-safe APIs.

## Behavior spec

**Set — host chrome (existing, harden)**

Given started `SailPlatform` and connected `instanceId`
When host calls `changeAppChannel(instanceId, channelId)`
Then DA processes join/leave via handlers; app receives `userChannelChanged`; connector emits `channelChanged` for chrome

**Get — host chrome (add)**

Given started platform and valid `instanceId`
When host calls `getAppUserChannel(instanceId)`
Then returns `string | null` from agent state (`currentUserChannel`) without sending DACP as the app

**Remove impersonation**

Given `sendDACPMessageOnBehalfOf` on public browser factory export
When this work ships
Then removed or deprecated; all in-repo hosts use `SailPlatform` channel APIs

**Desktop-agent purity**

Given need to dispatch app-originated requests from connector
When required for platform join/leave
Then use existing transport send + typed message builders in **platform-api** (current `changeAppChannel` pattern) — do **not** add Sail-specific public APIs on `DesktopAgent` for chrome

**Documentation**

Given `website/docs/architecture/channel-selection.md`
When this work ships
Then doc describes Pattern A (host chrome) vs Pattern B (`channelSelectorUrl`), set/get/listen table, and platform vs DA boundaries (keep in sync with code)

## Out of scope

- Implementing Pattern B selector iframe in sail-web (handshake URL path only; doc describes it).
- `platform.channels.onChanged` event namespace unless required by call sites.
- Docusaurus site build wiring beyond adding/updating markdown under `website/docs/`.

## TypeScript interfaces

```typescript
// sail-platform-api — add
getAppUserChannel(instanceId: string): string | null

// existing
changeAppChannel(instanceId: string, channelId: string | null): Promise<void>
getUserChannels(): BrowserTypes.Channel[]
```

## Test guidance

Platform-api unit tests: `getAppUserChannel` after join/leave; `changeAppChannel` started/not-started; grep remove `sendDACPMessageOnBehalfOf`. No new chrome APIs on `DesktopAgent` public class.

## Blocked decisions

- Resolved: `DesktopAgent.getAppUserChannelId(instanceId)` uses `getInstance` selector; `SailPlatform.getAppUserChannel` delegates to it.

## Loop history

- 2026-05-27: revised — scope platform-api set/get + docs; DA stays pure; channel-selection.md added
- 2026-05-27: revised per human — host chrome layering, Docusaurus two-pattern doc
- 2026-05-27: approved by human
- 2026-05-29: auto-deliver — getAppUserChannel + removed sendDACPMessageOnBehalfOf; branch pushed
- 2026-05-29: human approve all — PR #40

## Staged for review

**RED evidence:** New `sail-platform-channel.test.ts` — 8 tests (getAppUserChannel lifecycle, changeAppChannel guards, no `sendDACPMessageOnBehalfOf`).

**Commands:**
- `npm test` in `packages/sail-platform-api` — 12/12 pass
- `npm run build -w @finos/sail-desktop-agent` + `@finos/sail-platform-api` — pass

**Files changed:**
- `packages/sail-desktop-agent/src/core/desktop-agent.ts` — `getAppUserChannelId`
- `packages/sail-platform-api/src/sail-platform.ts` — `getAppUserChannel`
- `packages/sail-platform-api/src/sail-browser-desktop-agent.ts` — removed impersonation API
- `packages/sail-platform-api/src/__tests__/sail-platform-channel.test.ts` — new
- `packages/sail-platform-api/README.md`, `website/docs/architecture/channel-selection.md`, `sail-platform-sdk.md`

**Learnings proposed:**
- [AGENTS.md candidate] Host channel **read** uses `SailPlatform.getAppUserChannel` → `DesktopAgent.getAppUserChannelId` (state selector); **set** stays `changeAppChannel` via connector transport typed join/leave.
- [AGENTS.md candidate] `sendDACPMessageOnBehalfOf` removed from `createSailBrowserDesktopAgent`; channel chrome belongs on `SailPlatform` only.

## Escalation notes

## Learnings extracted
