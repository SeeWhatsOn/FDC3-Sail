# sail-desktop-agent — surface reduction & architecture realignment

**Status:** implemented — all three phases landed. See "Outcome" at the end.
**Branch base:** `wip/v3-local`
**Version context:** `3.0.0-pre.1.0` — pre-release, no backward-compatibility obligation.

## Why

The package was designed when the Desktop Agent was meant to run anywhere — browser, Node, worker — with a swappable transport so the same core could sit behind postMessage or WebSocket. That is no longer the direction. The DA runs in the browser; anything crossing a process boundary will be a relay or an app-connection adapter, built when it is actually needed.

The code and docs still carry the old design. The result is a public API that advertises seams that do not exist, hides the one that does, and costs new contributors real time to navigate.

Three concrete symptoms:

- `Transport` is exported as a public swap point. Its own docblock calls it "legacy test-only". It has one production implementation.
- `AgentAppConnection` — the real edge contract — is not exported, while `attachAppConnection()` (public) takes it as a parameter. An integrator cannot type an implementation of the only replaceable part.
- Of 60+ named root exports, ~18 are consumed by anything. The rest read as public contract to anyone opening `index.ts`.

## Principles

Agreed rules driving every decision below:

1. **Ship it whole.** `SailDesktopAgent` is the product. One construction path, one import.
2. **Defaults are internal data.** Overrides arrive through typed constructor options. Reads happen through getters on the class. Export the *type*, never the default value.
3. **YAGNI on seams.** Do not export an extension point for a consumer that does not exist. Re-adding is additive and cheap; removing later is breaking.
4. **Validation is the agent's job**, not an injected concern.

## Phase 1 — Subtraction

No behaviour change. Pure removal.

### 1.1 Delete `Transport`

Only two references in production `src/`:

- `implements Transport` on [message-port.ts:47](../../packages/sail-desktop-agent/src/app-connection/message-port.ts:47)
- `createDacpResponseDispatcher(edgeTransport: Transport)` at [dacp-response-utils.ts:100](../../packages/sail-desktop-agent/src/handlers/utils/dacp-response-utils.ts:100) — **test-only**; production uses `createDacpResponseDispatcherFromDelivery`

`app-connection-registry.ts` and all three `wcp-*.ts` files already type against the concrete `MessagePortTransport` class.

Steps:

- Drop the `implements Transport` clause from `MessagePortTransport`. Keep the class and its methods unchanged.
- Move `createDacpResponseDispatcher` into test support, declaring the port shape it needs locally.
- Delete `src/interfaces/transport.ts`.
- Reduce `src/interfaces/index.ts` to the `Logger` exports and rewrite its header — it currently claims to hold "contracts that environment-specific implementations must fulfill… allowing it to remain pure and portable".

### 1.2 Remove the `/browser` subpath

`/browser` maps to `dist/app-connection/index.mjs` — the browser **app-connection** parts, not a browser build of the agent. The name implies an environment variant and invites the question "where is `/node`?".

- Delete the `./browser` entry from `package.json` `exports`.
- Delete `src/app-connection/index.ts` (already marked `@deprecated`).
- Delete the path mapping at [sail-platform/tsconfig.json:8](../../packages/sail-platform/tsconfig.json:8).
- Fix the two consumers: [sail-platform/src/sail-platform.ts:21-22](../../packages/sail-platform/src/sail-platform.ts:21) and [sail-conformance-harness/src/harness-bootstrap.ts:2](../../packages/sail-conformance-harness/src/harness-bootstrap.ts:2) — the harness needs only the `AppConnectionMetadata` type.
- Remove `BrowserAppConnection` / `MessagePortTransport` / `AppConnectionEvents` from [sail-platform/src/index.ts:67-74](../../packages/sail-platform/src/index.ts:67).

A future WebSocket or native edge ships as its own package implementing the edge contract — not as a subpath here.

### 1.3 Keep the edge internal

Do **not** export `AgentAppConnection`. Mark `attachAppConnection()` `@internal` so the public-method / unexportable-parameter mismatch resolves by making both non-public. Tests live inside the package and are unaffected.

### 1.4 Cut the root export list

Apply principle 2. Remove from `src/index.ts`:

| Removed | Replacement for consumers |
|---|---|
| `DEFAULT_FDC3_USER_CHANNELS` | `userChannels` option; `getUserChannels()` |
| `DEFAULT_SAIL_DESKTOP_AGENT_CONFIG` | individual options |
| `DEFAULT_SAIL_IMPLEMENTATION_METADATA` | `implementationMetadata` option; `getImplementationMetadata()` |
| `resolveDesktopAgentConfig`, `DesktopAgentConfig`, `DesktopAgentOptions` | — internal |
| `AgentState`, `AppInstance`, `AppInstanceState`, `StateSetter`, `createInitialState`, `createStateWithOverrides` | — internal |
| `retrieveAllApps`, `retrieveAppsById`, `retrieveApps`, `retrieveIntents`, `retrieveAllIntents`, `retrieveAppsByUrl` | — internal |
| `fetchAppDirectory`, `isValidDirectoryUrl` | `apps.addDirectory(url)` |
| `DACPRequestType`, `DACPResponseType`, `DACPEventType`, `DACPMessageType` | — internal |
| `DACPHandlerContext`, `DacpResponseDispatcher`, `DacpOutboundMessage`, `DACPMessage`, `MessageType`, `WCPMessageType` | — internal |

Retained (evidence: actually imported by `sail-platform` / `sail-finance` / `sail-conformance-harness`):

`SailDesktopAgent` · `SailDesktopAgentOptions` · `SailDesktopAgentApps` · `SailDesktopAgentChannels` · `SailDesktopAgentHostControllers` · `DesktopAgentAppInstance` · `DesktopAgentOpenOptions` · `AppChannelChangeEvent` · `HandshakeFailureEvent` · `SailImplementationMetadata` · `DirectoryApp` · `WebAppDetails` · `Logger` · `LogPayloadDetail` · `DACPValidationError` · host-contracts (`AppLauncher`, `IntentResolver`, `IntentResolutionRequest`, `BrowserIntentResolverController`, `ChannelControl`, …)

`DesktopAgent` stays exported **as a type only**, marked `@internal` — three type-position uses in `sail-platform`, and TypeScript declaration emit needs the base class of `SailDesktopAgent` to be nameable.

Two things to verify rather than assume during implementation:

- **Directory sub-types** (`DirectoryData`, `DirectoryIntent`, `NativeAppDetails`, `LaunchDetails`, `AppType`, `Icon`, …). Some may need to stay exported for `DirectoryApp` declaration emit. Cut them, run `tsc`, restore only what the compiler demands.
- **`DACPTimeoutError` / `DACPProcessingError`.** Unused by consumers, but if either is thrown on a path an integrator can catch, it must stay for `instanceof`. Check the throw sites before removing.

### 1.5 Fix redundant call sites

[harness-bootstrap.ts:158](../../packages/sail-conformance-harness/src/harness-bootstrap.ts:158) and `harness-open-with-context.harness.ts:275` pass `userChannels: DEFAULT_FDC3_USER_CHANNELS` — which is already the default. Delete both lines.

The ~40 in-package test uses import via relative source path (`../../default-user-channels`) and are unaffected.

## Phase 2 — Validation moves into the agent

### Current state

The hook is live at [handlers/index.ts:38](../../packages/sail-desktop-agent/src/handlers/index.ts:38), but:

- `createZodValidator()` is never called — only re-exported from [sail-platform/src/index.ts:97](../../packages/sail-platform/src/index.ts:97)
- `validateDACPMessage` / `safeParseDACPMessage` are likewise never called
- its schemas live in `sail-platform/src/services/validation/dacp-schemas.ts`, headed "Auto-generated… Run `npm run generate:schemas`" — **that script does not exist anywhere in the repo**
- the schemas duplicate `@finos/fdc3-schema`, which `sail-desktop-agent` already depends on (`^2.2.1-beta.3`) and imports directly in seven files

Net today: DACP request payloads are not schema-validated in any shipped configuration, while the repo carries an orphaned 27-schema file, a zod dependency, and a validator nobody constructs. The injection seam is what made this invisible — "no validator supplied" is a legal configuration, so the agent cannot report that it is not validating.

### Target

```ts
type ValidationMode = "off" | "warn" | "strict"   // exported type
validation?: ValidationMode                       // on SailDesktopAgentOptions
```

Default `"warn"`, set in `default-config.ts` (internal, per principle 2 — no exported constant).

- `off` — no validation
- `warn` — validate, log failures, still dispatch
- `strict` — validate, reject invalid messages, throw `DACPValidationError`

`"warn"` is the default deliberately. `strict` by default would turn a FINOS toolbox test that passes today into a failure the moment a client library sends a slightly-off shape — a behaviour change disguised as a bug fix. Warn surfaces the diagnostic without changing dispatch.

### Steps

- Implement validation inside `sail-desktop-agent` against `@finos/fdc3-schema`.
- Delete `MessageValidator` / `ValidationResult` and the `validator` option from `DesktopAgentOptions`. **These leave in this phase, not Phase 1** — `sail-platform`'s zod validator still imports them until it is deleted here.
- Delete `sail-platform/src/services/validation/` entirely: `zod-validator.ts`, `dacp-zod-validator.ts`, `dacp-schemas.ts`, `index.ts`.
- Remove the validation exports from [sail-platform/src/index.ts:95-102](../../packages/sail-platform/src/index.ts:95), including `export * from "./services/validation/dacp-schemas"` — a wildcard publishing ~27 zod schemas.
- Drop `zod` from `sail-platform/package.json`. It is used by nothing else in that package.

This phase adds code where every other phase removes it. That is deliberate: unvalidated wire input from third-party iframes is a bug class, not a missing feature. If it needs to be deferred, the deletions above still stand on their own — do them, and land the built-in validation separately.

## Phase 3 — Documentation

The `website/docs/packages/desktop-agent/*` pages are the most current artifacts and already say browser-first. The drift is elsewhere.

- **[README.md:35-70](../../README.md:35)** — the architecture diagram still draws `WCPConnector (@finos/sail-desktop-agent/browser)` and a `Transport (swappable)` tier. `WCPConnector` is a name [AGENTS.md:143](../../AGENTS.md:143) explicitly rejects; the transport tier no longer exists. Also fix: "transport-agnostic… runs in any JavaScript environment", and the package table listing `packages/sail-ui` (the package is `sail-theme`).
  Replace with: app → WCP/MessagePort → `BrowserAppConnection` → `DesktopAgent` → handlers/state → `AppConnectionRegistry`.
- **[AGENTS.md:143](../../AGENTS.md:143) and [AGENTS.md:163](../../AGENTS.md:163)** — both name `createBrowserDesktopAgent` as the host entry point. The code ships a `SailDesktopAgent` class. Update the entry-point name, drop the `Transport`-stays-in-`interfaces/` line, and record that the edge is internal.
- **[packages/sail-desktop-agent/README.md:3](../../packages/sail-desktop-agent/README.md:3)** — "Pure, transport-agnostic".
- **[website/docs/packages/desktop-agent/overview.md](../../website/docs/packages/desktop-agent/overview.md)** — delete the "Two ways to integrate" table and the "Subpath exports" section; soften "also runs in Node.js" to describe handler-level testing only.
- **[composition.md:50-74](../../website/docs/packages/desktop-agent/composition.md:50)** — delete the "Preset vs manual composition" diagram and table. `SailDesktopAgent extends DesktopAgent`; it is a subclass, not an assembly, and bare `DesktopAgent` throws on any routing without an attached edge ([desktop-agent.ts:320](../../packages/sail-desktop-agent/src/agent/desktop-agent.ts:320)). Presenting manual composition as a peer option is inaccurate.
- **[getting-started.md:73-78](../../website/docs/getting-started.md:73)** — collapse the entry-point table to one row; delete "Path 1 / Path 2" framing.
- **[integrator-guide.md:629,661,696](../../website/docs/packages/desktop-agent/integrator-guide.md:629)** — remove `/browser` import guidance.

Add a short **Validation** section to the integrator guide covering the three modes and why `warn` is the default.

## Open decisions

**1. `DEFAULT_FDC3_USER_CHANNELS` — RESOLVED: keep it exported.** The single deliberate
exception to principle 2, on the grounds that it is FDC3 spec data rather than a Sail
tuning knob, and hosts need it *before* the agent exists to extend the standard set.

Original framing below for context.


Cucumber does `[...DEFAULT_FDC3_USER_CHANNELS, ...CUCUMBER_CONFORMANCE_USER_CHANNELS]` at [generic.steps.ts:190](../../packages/sail-desktop-agent/test/step-definitions/generic.steps.ts:190) — "standard 8 plus mine". Fine internally, but once the constant is private an external host wanting that has to hand-write all 8 with correct FDC3 ids and colours. Channels are fixed at construction, so a getter cannot help — the list is needed before the agent exists.

Recommended: **accept it.** Most hosts want the standard set or a fully custom one. If someone hits it, re-exporting the constant is a one-line additive fix.
Alternative: keep it exported as the single deliberate exception, on the grounds that it is FDC3 spec data rather than a Sail tuning knob.

**2. Does Phase 2 land now or as a follow-up?** Phases 1 and 3 are independently shippable.

## Verification

- `npm run validate` in `sail-desktop-agent` (typecheck + lint + format) — the declaration-emit check that decides which directory sub-types survive.
- Full Vitest + Cucumber suite (~135 `@fdc3_2.2` scenarios) — Phase 1 must be green with zero behaviour change.
- Typecheck `sail-platform`, `sail-finance`, `sail-conformance-harness` against the reduced surface.
- FINOS toolbox run via the conformance harness after Phase 2, on each of `off` / `warn` / `strict`.
- Grep for stale names after Phase 3: `WCPConnector`, `createBrowserDesktopAgent`, `createWCPClient`, `sail-desktop-agent/browser`, `transport-agnostic`, `packages/sail-ui`.

## Expected outcome

| | Before | After |
|---|---|---|
| Root named exports | 60+ plus two wildcards | ~25 |
| Exported values | many | `SailDesktopAgent` + error classes |
| Entry points | 2 subpaths, 2 documented composition paths | 1 |
| Transport abstraction layers | 2 (`Transport`, `AgentAppConnection`) | 1, internal |
| DACP validation in shipped config | none | on by default (`warn`) |
| zod dependency | `sail-platform` | none |

## Outcome

All three phases landed. Verification:

- `sail-desktop-agent` builds; **152/152 Cucumber scenarios, 1441/1441 steps pass**
- Typecheck clean in `sail-platform` and `sail-conformance-harness`
- Typecheck and lint error counts in `sail-desktop-agent` are **identical to the pre-change
  tree** (4 pre-existing errors, verified by stashing) — zero regressions

Deviations from the plan as written:

- **`vite.config.ts` also listed the deleted `/browser` entry** — the plan missed it; the
  build failed until it was removed.
- **`BrowserAppConnection`, `AppConnectionMetadata`, `AppConnectionOptions` had to stay
  exported as types.** `SailDesktopAgent.connector` is a public property typed with the
  first, and `onAppConnected` / `appConnectionOptions` use the others. Declaration emit
  requires the names. `BrowserAppConnection` is marked `@internal`.
- **All three DACP error classes kept.** `DACPTimeoutError` (`dacp-utils.ts:23`) and
  `DACPProcessingError` (`handlers/index.ts:69`) are thrown on live paths.
- **Directory sub-types were not needed** — `DirectoryApp` and `WebAppDetails` alone
  satisfy declaration emit.
- **`main.test.ts` improved rather than ported** — it now asserts on the constructed
  agent's `getImplementationMetadata()` instead of re-running the internal merge.
- **Redundant `userChannels: DEFAULT_FDC3_USER_CHANNELS` call sites left in place.** Once
  the constant stayed exported (decision 1), passing it explicitly is legitimate, if
  redundant, usage rather than something to purge.

### Finding: Cucumber fixtures send off-spec messages

With validation live, **38 of 458** routed messages fail FDC3 schema validation in the
Cucumber suite. These are genuine fixture defects, not validator false positives —
confirmed by probing `Convert.to*` and by hand-built valid samples passing:

- `openRequest` with `"context": {"bogus": true}` — context missing required `type`
- `broadcastRequest` with no `channelId`, and another with `channelId: null` — the FDC3
  schema requires a string

This is direct evidence for the `warn` default: `strict` would have failed 38 messages and
broken 152 passing scenarios. **Worth a follow-up** to decide per case whether the fixture
should be fixed or the agent deliberately accepts the shape. Not addressed here.

### Related: closes BLOCK-5 from `FDC3-SAIL-REVIEW.md`

That review flagged the root README claiming "Sail validates all FDC3 DACP messages using
Zod schemas" while the validator was never injected, and recommended either wiring it on
or correcting the README. Validation is now on by default — via `@finos/fdc3-schema`
rather than zod. `FDC3-SAIL-REVIEW.md` is a point-in-time document and was left unedited;
its "transport-agnostic" and `createZodValidator` references are now historical.
