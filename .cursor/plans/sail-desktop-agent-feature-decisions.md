# sail-desktop-agent — feature decisions to explore

**Status:** open register — items are questions, not agreed work.
**Branch base:** `wip/v3-local`
**Version context:** `3.0.0-pre.1.0` — pre-release, no backward-compatibility obligation.

## What this is

Areas of the Desktop Agent's **feature and function** that need a deliberate look and a decision:
contracts we may not need, seams that may be pointed the wrong way, behaviour we have not settled.

Not a place for type or code cleanup — those get resolved in the normal course of work.

Each item: what prompted it, the evidence, the open question. Add new items as they surface.

---

## 1. `ChannelControl` — does the host channel seam earn its place?

**Prompted by:** a pass over the package's contracts. `ChannelControl` reads as a redundant piece
of code — it describes a host integration point that nothing uses and nothing triggers.

**Files:** [channel-control.ts](../../packages/sail-desktop-agent/src/host-contracts/channel-control.ts),
re-exported at [host-contracts/index.ts:27](../../packages/sail-desktop-agent/src/host-contracts/index.ts:27)

### What it is

`ChannelControl.selectChannel(request) => Promise<string | null>` is a **callback the host
implements**, so the agent can ask the host "which channel?" and wait for an answer. Its docblock
scopes it to the case where the platform owns the channel chrome (`channelSelectorUrl` is `false`
in the WCP handshake).

It has no implementations and no call sites — only the declaration and the one re-export line.

### What ships instead

Hosts change channels imperatively, through the `agent.channels` controller:

| Consumer | Call |
|---|---|
| `sail-finance` ChannelSelector | [ChannelSelector.tsx:57](../../packages/sail-finance/src/components/ChannelSelector.tsx:57) — `changeAppChannel` |
| `sail-finance` connection store | [connection-store.ts:242](../../packages/sail-finance/src/stores/connection-store.ts:242) — `onAppChannelChange` |
| `sail-one` host | [sail-host.ts:347](../../packages/sail-one/src/state/sail-host.ts:347), [:156](../../packages/sail-one/src/state/sail-host.ts:156) |

So there are two designs in the tree for the same job, pointing opposite ways: one where the agent
asks the host, one where the host drives the agent. Only the second is wired up.

### Why the direction matters

Worth settling on principle rather than on "which one has callers today". The deciding factor is
**who initiates**:

- **Intent resolution is agent-initiated.** A `raiseIntent` promise is blocked until a human picks,
  so the agent has to call out and wait. That is a genuine callback seam, and it exists:
  `intentResolverNeeded` / `requestIntentResolution`
  ([sail-desktop-agent.ts:187](../../packages/sail-desktop-agent/src/agent/sail-desktop-agent.ts:187)).
- **Channel selection is user-initiated.** Nothing in the agent is pending when a user opens a
  channel picker. `channelSelectorUrl` is read only to build the WCP3Handshake payload
  ([browser-app-connection.ts:83-94](../../packages/sail-desktop-agent/src/app-connection/browser-app-connection.ts:83));
  no inbound DACP or WCP message ever puts the agent in a state where it must ask.

There is also a case a callback cannot express: an app can join a channel itself via
`fdc3.joinUserChannel()` with no host involvement, and the host chrome still has to update. That
needs an event stream, which `onAppChannelChange` provides.

### Open question

Does `ChannelControl` describe a real need we have not built yet, or a design we already moved
past? If the latter, delete it — re-adding a contract later is additive and cheap, and leaving it
advertises a seam integrators cannot actually use.

Worth checking before deciding: whether any host-owned channel flow we intend to support would
genuinely need the agent to ask and wait.

---

## 2. _(next item)_
