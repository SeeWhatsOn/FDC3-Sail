# AGENTS.md — `@finos/sail-desktop-agent`

The FDC3 engine. Headless, pure FDC3, usable on its own. Repo-wide rules are in the root
`AGENTS.md`; this file holds what only matters inside this package.

## One class, one construction path

There is **one** class, `SailDesktopAgent`, in `agent/`. There is no `DesktopAgent` base
class. `sail-desktop-agent-controllers.ts` and `sail-desktop-agent-types.ts` are siblings
split out against the `max-lines: 500` budget — packaging only, still one facade. Public
types export from those owners and from `src/index.ts`, never via re-export barrels on
`sail-desktop-agent.ts`. Don't micro-split further for line count alone.

`new SailDesktopAgent(options)` from the package root is the single public construction
path. The `/browser` subpath export was removed; everything public comes from the root.

**The grouped controllers — `channels`, `intentResolver`, `apps` — are the only public
spelling.** The flat catalog methods (`getApps`, `openApp`, `getAppConnection()`,
`getUserChannels`, …) are private. Use `apps.getConnection()`,
`channels.getUserChannels()` and so on. `getBrowserDesktopAgentSession` throws by design,
as an architecture assertion.

## `src/` layout

Role-first at the `src/` root, with no `core/` wrapper:

| Directory | Holds |
|---|---|
| `agent/` | `SailDesktopAgent`, controllers, `default-config` |
| `app-connection/` | `BrowserAppConnection`, `AppConnectionRegistry`, `wcp/` — **internal**, not a public host API |
| `handlers/` | DACP dispatch, 1:1 with request types; cluster subfolders like `intent-handlers/` |
| `state/` | FDC3 `AgentState`, with Immer `produce` confined to `state/mutators/*` |
| `dacp/` | Wire helpers — constants, creators, validation |
| `host-contracts/`, `app-directory/`, `logging/`, `errors/` | As named |

WCP and connection mechanics stay out of `handlers/`. There is no `Transport` abstraction
in `src/` — that type lives in `test/support/transport.ts` for handler-only dispatch
recording. Reject `BrowserConnectionBackend` and public `WCPConnector` naming.

## The browser path

```
app → WCP/MessagePort → BrowserAppConnection → SailDesktopAgent → handlers/state
                                                      → AppConnectionRegistry.sendToAppInstance()
```

No browser-path `Transport` hop. `SailDesktopAgent` holds the single `AgentState`;
`AgentState` (FDC3 semantics) and `AppConnectionRegistry` (`instanceId` → MessagePort) are
separate concerns. `disconnectInstance()` is the single teardown entry — FDC3 state cleanup
plus port prune.

**WCP and DACP share one MessagePort but are different protocols.** WCP1–3 stay on
`window.postMessage` in `BrowserAppConnection`; WCP4 rides the port into
`handleWcpMessage`; browser WCP6 is handled in `bridgeAppPort` and never reaches the agent
on that path. One MessageChannel serves the whole connection life — the registry only
rekeys `temp-{connectionAttemptUuid}` to the WCP5 validated `instanceId`. The temp value is
a routing id, not a second channel.

## Identity and the trust boundary

**Never guess identity from app-supplied `meta.source.appId`.** `resolveDacpHandlerInstanceId`
reads only a registered `hostInstanceId`, a registered MessagePort `instanceId`, or
`wcpHandshakeRouting`.

*Registered* is load-bearing. At the MessagePort trust boundary in `bridgeAppPort`, strip
app-supplied `meta.source`, `meta.messageOrigin` and `meta.hostInstanceId`, then stamp them
from the connection registry — `instanceId` from the port-to-instance map, `messageOrigin`
only from the stored WCP1, otherwise omitted. Never keep the app's values. So the value
`resolveDacpHandlerInstanceId` reads can only be one the agent itself stamped.

**Validate the raw message, before enrichment.** FDC3 WCP4 and WCP6 meta carry
`additionalProperties: false`, so validating after `enrichMessageWithSource` rejects every
well-formed handshake under `strict`. Validation lives in `dacp/validate-dacp-message.ts`
against `@finos/fdc3-schema` `isValid*` guards, controlled by
`validation: "off" | "warn" | "strict"` (default `warn`). Don't reintroduce an injectable
`MessageValidator` or a hand-maintained schema copy.

Host-assigned instance ids reach the agent through WCP4 adoption — `reconnectInstanceId`,
WCP1 `hostIdentifier`, or sole-pending lookup in `wcp-host-instance-adoption.ts` — never
through app-authored DACP meta.

**On WCP5 remap to an existing validated `instanceId`:** don't `Object.assign` restore from
`recentlyDisconnected`, because the new handshake metadata wins. Retire the displaced
transport's unregister-then-disconnect, so an old port's goodbye cannot tear down the live
connection.

**WCP4 handshake routing vs WCP5 instance id.** During identity validation,
`context.instanceId` may still be the handshake routing id while `startHeartbeat` and
`state.heartbeats` use the validated WCP5 `instanceId`. Disconnect cleanup must resolve the
validated id — see `resolveTeardownInstanceId` in `instance-teardown.ts`. Inner
`instanceIdentityRegistry` maps must be pruned in `cleanupInstanceDacpState`, on the same
paths as `removeInstance`; a failed WCP4 adds no entries.

## `structuredClone` traps

`InMemoryTransport.send` uses `structuredClone`, so:

- **Never put a `Window` on DACP message meta** — it throws `DataCloneError`. Store WCP1Hello
  source windows in `handlers/dacp/wcp-pending-source-window.ts`, keyed by temp `instanceId`,
  and resolve them in `handlers/dacp/wcp-handlers.ts`.
- **`raiseIntentResultResponse` must not share one object reference** between
  `payload.resultMetadata` and `intentResult.metadata`. `structuredClone` treats a shared
  ref as a cycle and breaks WCP intent-result delivery — clone separately, e.g. via
  `cloneIntentResultContextMetadata`.

## Ordering

For open-with-context listener readiness, **"listener stored in `AgentState`" is not
"client proxy has wired the callback."** `@finos/fdc3-agent-proxy` registers listeners after
`addContextListenerResponse`, so pending `broadcastEvent` delivery must be ordered *after*
that response on the target MessagePort.

Channel membership is per connected `instanceId`, globally unique across apps in Sail —
not per `appId`. User channels are fixed at construction, defined once as
`DEFAULT_FDC3_USER_CHANNELS` in `agent/default-user-channels.ts` and imported directly by
production, Vitest and Cucumber alike.

## Testing conventions

- **Production types carry no test-only methods.** No `*ForTesting` helpers on
  `SailDesktopAgent`, handlers or transports; no exposing private handler context builders.
  Test-only cleanup hooks belong next to the code under test — e.g.
  `clearAllHeartbeatTimersForTesting()` in `heartbeat-runtime.ts`.
- **Prefer production APIs in BDD** when exercising real behaviour, e.g.
  `desktopAgent.disconnectInstance(instanceId)` for disconnect cleanup — the same path as
  WCP6 goodbye and heartbeat timeout.
- **Harnesses:** `createDACPTestContext()` (`src/handlers/__tests__/test-context.ts`) for
  isolated handler tests, with `MockTransport` as a `DacpResponseDispatcher` only.
  `createDesktopAgentWithTestConnection()` (`test/support/dacp-test-app-connection.ts`)
  for full-agent tests — it injects `DacpTestAppConnection` through the `@internal`
  `appConnection` constructor option. Construction is single-phase: there is no
  `attachAppConnection()` and no `wireDacpTestAppConnection()`.
- **`applyDesktopAgentStateUpdate()`** (`test/support/agent-state.ts`) is for Cucumber
  fixture setup only, not part of the public API.
- **Never mock `globalThis.crypto.randomUUID` in `CustomWorld`.** Cucumber assigns
  test-case ids via `crypto.randomUUID`; a per-scenario counter produced duplicate ids and
  only ~15 of 168 scenarios ever executed.
- **Cucumber config is `cucumber.yml` only** (`paths: test/features`). A second legacy
  `.cucumber` features path merges duplicates.
- `CustomWorld.initializeDesktopAgent()` defaults `heartbeatEnabled: false`; heartbeat
  scenarios opt in. Don't wire `requestIntentResolution` on default init — lazy-wire it for
  resolver and cancel scenarios.
- **Prefer `vi.waitFor` on observable counters over wall-clock sleeps.** Keep
  `flushAsyncDelivery()` (`setTimeout(0)`) for single-hop async.
- **Handlers are mostly synchronous `void` functions** — don't `await` them in tests, and
  don't mark the surrounding `it()` callback `async`.
- **Green BDD does not prove browser WCP.** The `@fdc3_2.2` suite (~135 scenarios) uses
  `DacpTestAppConnection` with pre-registered instance ids. Only
  `wcp-desktop-agent.integration.test.ts` exercises the WCP-to-agent seam today.

## Cucumber tags

Tags **filter and classify**. They do not wire hooks — global teardown lives in
`test/support/hooks.ts` and runs after every scenario.

| Tag | Meaning |
|---|---|
| `@fdc3_2.0` | Exercises FDC3 2.0 Desktop Agent API behaviour |
| `@fdc3_2.2` | In scope for 2.2, including 2.2-only APIs (`addEventListener`, `ContextMetadata`, `MalformedContext`) |
| `@fdc3_3.0` | In scope for 3.0. All 2.2 scenarios carry it at feature level except 3.0-only APIs (`fdc3.close()` in `close.feature`) |
| `@failing` | Known-broken; excluded by default. Run with the `failing` profile while fixing |
| `@wip` | Incomplete; excluded from CI |
| `@slow` | Long waits or timing-sensitive |

Multiple version tags on one scenario are supported and expected — `@fdc3_2.2 @fdc3_3.0`
on a feature line tags every scenario for both filters. Version profiles: `fdc3-2.0`,
`fdc3-2.2`, `fdc3-3.0`.

Optional functional-area tags for targeted runs: `@user-channels`, `@app-channels`,
`@private-channels`, `@intents`, `@broadcast`, `@heartbeat`, `@disconnect`, `@apps`, `@wcp`.

**Priority-style tags (`@p0`, `@p0-cleanup`) don't describe FDC3 behaviour** — keep them
out. Cleanup assertions belong in steps (`Then no heartbeat timers are active`); process
hygiene belongs in `After` hooks.

## Schema fidelity

**DACP event payloads follow `@finos/fdc3-schema` exactly.** `createDACPEvent(type, payload)`
takes `Record<string, unknown>`, so `tsc` cannot catch an off-schema field. Check
`node_modules/@finos/fdc3-schema/dist/schemas/api/<event>.schema.json` — **not** the
generated `BrowserTypes.d.ts`, which flattens `anyOf` into optional fields and silently
loses mutual-exclusion constraints.

Official DACP/WCP wire types come from `BrowserTypes` in `@finos/fdc3`; reach into
`@finos/fdc3-schema/dist/generated/api/BrowserTypes` only for runtime validators.
