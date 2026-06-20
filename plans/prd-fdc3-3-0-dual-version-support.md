# PRD: FDC3 3.0 support and dual-version strategy (2.2 + 3.0)

## Persona / user

- **FDC3 app developer** shipping against `@finos/fdc3` 2.2 today who needs a clear upgrade path to 3.0 APIs (`fdc3.close()`, optional `ContextMetadata`, stricter handler signatures).
- **Desktop Agent integrator** embedding `@finos/sail-desktop-agent` who must advertise an accurate `getInfo().fdc3Version` and pass FINOS conformance for the spec level they claim.
- **Sail maintainer** sequencing 2.2 toolbox burn-down (v5 baseline) without forking the agent or breaking existing 2.2 apps.

## Goal / outcome

Add **incremental FDC3 3.0** capability to the existing single DACP handler tree while **keeping 2.2 behavior and conformance green**. Answer the dual-version question explicitly: **yes, one agent can support both** — not by running two codebases or per-app version negotiation, but by **wire-forward-compatible handlers** plus a **configurable advertised `fdc3Version`** that flips only when 3.0 conformance is proven.

Success is:

1. 2.2 toolbox pass rate continues to improve on the v5 follow-up track (no regression from 3.0 work).
2. Required 3.0 APIs and DACP wire fields are implemented behind `@conformance3.0` BDD and, when ready, a 3.0 toolbox baseline.
3. Integrators understand when to keep `fdc3Version: "2.2"` vs bump to `"3.0"`.

## Relationship to other plans

| Prior plan | Status | This PRD |
|------------|--------|----------|
| `plans/prd-toolbox-conformance-v5-follow-up.md` | Active — 2.2 harness hygiene + WCP | **Extend** — finish 2.2 before flipping advertised version; no duplicate teardown rows |
| `plans/prd-browser-preset-host-api.md` | Active — host controllers | **No duplicate** — `AppLauncher.close` already wired for v3.0 self-close |
| `plans/prd-desktop-agent-state-hardening.md` | Mostly delivered | **No duplicate** unless instance lifecycle blocks 3.0 open-with-context |
| `FDC3_2_2_REMEDIATION_PLAN.MD` | Partial | **Superseded for versioning strategy** — this PRD owns 2.2→3.0 path; keep open 2.2 rows until closed |
| FINOS toolbox v5 export | Baseline 53/49 pass | **Extend** with future v6+ 3.0 pack when `@finos/fdc3` 3.x client ships |

## Can we support both 2.2 and 3.0?

**Yes — with one codebase and one advertised version at a time.**

| Question | Answer |
|----------|--------|
| Two handler trees (`handlers/v2` vs `v3`)? | **No** — one tree; optional wire fields and `@conformance2.2` / `@conformance3.0` tags |
| Per-connection `fdc3Version` negotiation? | **Out of scope** — agent advertises one version via `getInfo` / WCP3; apps read it and use matching client APIs |
| Can 2.2 apps run against a 3.0-advertising agent? | **Mostly yes** — 3.0 is additive except **removed deprecated 2.2 APIs** (see below). Apps on `@finos/fdc3` 2.2 that avoid deprecated APIs keep working |
| Can 3.0 apps run while agent advertises `"2.2"`? | **Partially** — new calls (`fdc3.close()`, metadata args) need agent handlers; today `closeRequest` works but `fdc3Version` still reports `"2.2"` until we intentionally bump |
| npm `@finos/sail-desktop-agent` `3.0.0-pre.x` vs FDC3 spec? | **Unrelated** — product semver; `implementationMetadata.fdc3Version` is the FDC3 spec level (`"2.2"` today) |

### FDC3 3.0 delta (product-relevant)

**Breaking (apps must migrate — agent should not reintroduce removed APIs):**

| Removed in 3.0 | Sail today | Action |
|----------------|------------|--------|
| `joinChannel` | Not implemented (uses user-channel APIs) | None |
| `getSystemChannels` | Not implemented | None |
| `open(name)` string overload | Uses `AppIdentifier` | None |
| `raiseIntent(..., name)` | Uses structured args | None |
| Single-arg `addContextListener` | Handler uses 2.2 two-arg path | Add 3.0 `(type, handler, metadata?)` when bumping types |
| PrivateChannel sync `on*` hooks | Async listeners only | Verify on private-channel work |
| **New required:** `fdc3.close()` | `closeRequest` handler + `@conformance3.0` BDD | **Done (agent side)**; host `AppLauncher.close` optional |

**Additive (wire-forward — implement without breaking 2.2 clients):**

| 3.0 addition | Sail today | Gap |
|--------------|------------|-----|
| Optional `metadata` on `open`, `broadcast`, `raiseIntent`, `raiseIntentForContext` | Partial — intent result metadata delivered; open/broadcast do not read `payload.metadata` | **Wire passthrough + listener delivery** |
| `getResultMetadata()` | DACP path exists; toolbox had 4 empty-metadata rows (v5) | **Verify client + harness path** |
| `getCurrentContextWithMetadata()` | Not implemented | **New handler / channel API** |
| `clearContext()` | Not implemented | **New handler** |
| `open(app, null, metadata)` | `handleOpenRequest` ignores metadata | **Forward metadata on open-without-context** |
| Security / `@experimental` features | Not in scope for first slice | Defer |

**Recommended dual-version posture:**

```text
Phase A (now):     fdc3Version "2.2" + wire-forward optional fields + @conformance3.0 BDD for new APIs
Phase B:           3.0 toolbox baseline on harness (:3001) with @finos/fdc3 3.x client (when published)
Phase C:           Flip default fdc3Version to "3.0" + document app migration for deprecated APIs
Phase D (optional): Long-tail 2.2-only integrators override config back to "2.2" until they migrate apps
```

Do **not** split packages or duplicate handlers. Do **not** block 2.2 toolbox work for speculative 3.0 refactors.

## In scope

| ID | Summary | MoSCoW | Kind | Work item slug |
|----|---------|--------|------|----------------|
| F30-00 | Epic — coordinate 2.2 burn-down + incremental 3.0 | Must | epic | `epic-fdc3-3-0-dual-version` |
| F30-01 | Spike — authoritative 3.0 vs 2.2 API/DACP delta checklist mapped to Sail handlers | Must | spike | `audit-fdc3-3-0-handler-delta` |
| F30-02 | Keep `@conformance2.2` BDD + v5/v6 toolbox green while landing 3.0 rows | Must | task | *(use existing v5 follow-up slugs — no new item)* |
| F30-03 | `openRequest`: accept and forward optional `payload.metadata` (3.0 wire); preserve 2.2 open-with-context | Must | task | `wire-open-request-context-metadata` |
| F30-04 | `broadcast` / intent raise: complete optional metadata passthrough on wire and to listeners | Must | task | `wire-broadcast-intent-metadata-3-0` |
| F30-05 | `fdc3.close()` production path — host `AppLauncher.close` + harness teardown alignment | Should | task | *(partially done — extend browser preset / harness)* |
| F30-06 | `getCurrentContextWithMetadata` + `clearContext` channel handlers | Should | task | `add-fdc3-3-0-channel-metadata-apis` |
| F30-07 | Local 3.0 types / `@finos/fdc3` upgrade strategy (types ahead of npm 3.x like `CloseRequestMessage`) | Must | task | `add-fdc3-3-0-local-types-and-dep-upgrade` |
| F30-08 | Expand `@conformance3.0` Cucumber coverage for landed APIs | Should | task | `expand-conformance3-0-bdd-coverage` |
| F30-09 | Configurable `implementationMetadata.fdc3Version` + WCP3 handshake alignment; default stays `"2.2"` until Phase C | Must | task | `configurable-fdc3-version-advertisement` |
| F30-10 | 3.0 toolbox harness run + baseline export (`conformance-report-v3.0-*.txt`) | Could | task | `record-fdc3-3-0-toolbox-baseline` |
| F30-11 | Integrator docs: dual-version strategy, app migration, when to bump advertised version | Should | task | `document-fdc3-2-2-3-0-dual-version` |

## Out of scope

- Per-app or per-connection FDC3 version negotiation
- Separate npm packages or handler folders for 2.2 vs 3.0
- Removing 2.2 support or dropping `@conformance2.2` BDD before 3.0 conformance passes
- `@experimental` security APIs (signing, anti-replay enforcement) in the first wave — design only unless FINOS toolbox requires them
- `@finos/fdc3` 3.0 **app** client changes inside mock apps (harness uses 2.2 client today)
- CI gate on 3.0 toolbox until baseline exists
- Rewriting sail-web (:3000) for 3.0 before harness (:3001) proves agent behavior

## Success criteria

- **Dual-version clarity:** This PRD + integrator doc (F30-11) answer “can we support both?” without a second codebase.
- **2.2 regression:** v6+ toolbox pass rate ≥ v5 baseline while F30-03–04 land.
- **3.0 APIs:** `@conformance3.0` scenarios green for every **Must** row shipped; `close.feature` stays green.
- **Advertised version:** Default `fdc3Version` remains `"2.2"` until F30-10 baseline + maintainer sign-off; integrators can override via `DesktopAgent` config / `WCPConnectorOptions.fdc3Version`.
- **Types:** No `import ... with { type: "json" }`; 3.0 wire types colocated with handlers until `@finos/fdc3` 3.x is pinned.

## BDD scenarios (candidates)

Full specs belong in work items; tag with `@conformance3.0`.

```gherkin
# close.feature (exists)
@conformance3.0
Scenario: App requests self-close successfully
  When the app requests close [fdc3.close]
  Then no success closeResponse is delivered
  And the instance is removed from agent state

@conformance3.0
Scenario: Open forwards caller metadata to target context listener
  When app A opens app B with context and ContextMetadata
  Then app B's context listener receives metadata with source and timestamp

@conformance3.0
Scenario: Broadcast attaches ContextMetadata on delivered event
  When app broadcasts context with metadata
  Then subscribers receive contextEvent with payload.metadata

@conformance3.0
Scenario: getCurrentContextWithMetadata returns channel context and metadata
  Given app joined a user channel with last broadcast metadata
  When app requests current context with metadata
  Then response includes context and metadata

@conformance2.2
Scenario: 2.2 open without metadata unchanged
  When app opens target with context only
  Then open-with-context delivery succeeds as today
```

## Architecture / implementation direction

1. **Single handler tree** under `packages/sail-desktop-agent/src/core/handlers/dacp/` — extend handlers; no `v2/` / `v3/` split (AGENTS.md policy).
2. **Wire-forward compatibility:** 2.2 clients omit optional fields; handlers treat missing `metadata` as today. 3.0 clients send `payload.metadata: {}` minimum on open/broadcast where schema requires it.
3. **Types:** Follow `CloseRequestMessage` pattern — local types in handler modules until `@finos/fdc3` ^3.x; then replace and re-export. Bump dependency in F30-07 only when FINOS publishes stable 3.x.
4. **Version advertisement:** `DEFAULT_SAIL_IMPLEMENTATION_METADATA.fdc3Version` in `sail-default-config.ts` remains `"2.2"`. `WCPConnectorOptions.fdc3Version` and `getInfo` must stay in sync. Flipping default to `"3.0"` is a **product decision** gated on 3.0 toolbox baseline, not a code-drive-by.
5. **Testing:** `@conformance2.2` (~103 MockTransport scenarios) + `@conformance3.0` (start with `close.feature`; grow per F30-08). Toolbox oracle remains authoritative for harness; BDD proves handler contracts.
6. **Host contracts:** v3.0 `fdc3.close()` → optional `AppLauncher.close(instanceId)` (already in `handleCloseRequest`). Browser preset `apps.disconnect()` for host teardown — not `apps.close()` (AGENTS.md).
7. **Sequencing:** Complete v5 follow-up (teardown, WCP two-app tests) **before** treating GetInfo2 / open-with-context failures as 3.0 work — those are 2.2 harness paths today.

## Risks / unknowns

| Risk | Mitigation |
|------|------------|
| `@finos/fdc3` 3.x npm not stable | Local types + pin upgrade in F30-07 spike |
| Toolbox 3.0 pack availability / scenario list | F30-10 blocked until FINOS publishes; track FINOS repo |
| Flipping `fdc3Version` to `"3.0"` breaks apps using removed APIs | Keep default `"2.2"`; document deprecated API removal; optional config override |
| Metadata cloning / `structuredClone` on MessagePort | Reuse `cloneIntentResultContextMetadata` patterns; separate refs for payload vs nested metadata |
| 2.2 vs 3.0 conformance overlap (GetInfo2) | Classify as open-with-context integration (2.2), not 3.0 metadata — see AGENTS.md toolbox triage |
| findIntent / apps[] policy | Stays on v5 follow-up PRD; not version-specific |

## Constraints

- FDC3 2.2 spec alignment for all non-deprecated behavior until advertised version bumps (AGENTS.md).
- No test-only methods on production types; `@conformance3.0` uses production DACP paths.
- Harness uses `@finos/fdc3` ^2.2.3 today — 3.0 toolbox may need harness dependency bump (F30-10).
- Node 24+, npm workspaces, Cucumber + Vitest conventions per AGENTS.md.
- Watson delivery: targeted tests per slice; defer full `npm run validate` until epic tranche completes.

## Commands

```bash
nvm use 24
npm test -w @finos/sail-desktop-agent
npm test -w @finos/sail-conformance-harness
npm run dev -w @finos/sail-conformance-harness   # :3001 manual toolbox
```

Cucumber filters:

```bash
npm test -w @finos/sail-desktop-agent -- --tags '@conformance3.0'
npm test -w @finos/sail-desktop-agent -- --tags '@conformance2.2'
```

## PRD accuracy gate (2026-06-20 / v3-pre)

| ID | Classification | Evidence | Work item slug |
|----|----------------|----------|----------------|
| F30-01 | spike | `investigate` — need mapped checklist vs FINOS 3.0 API reference | `audit-fdc3-3-0-handler-delta` |
| F30-02 | task | `verified-partial`: v5 53/49; v5 follow-up active | *(existing TV5-* slugs)* |
| F30-03 | task | `verified-gap`: `handleOpenRequest` reads `payload.context` only — `app-handlers.ts` L97–99 | `wire-open-request-context-metadata` |
| F30-04 | task | `verified-partial`: intent result metadata in `intent-result-metadata.ts`; broadcast/open gaps | `wire-broadcast-intent-metadata-3-0` |
| F30-05 | task | `verified-partial`: `handleCloseRequest` + `close.feature` `@conformance3.0`; host close optional | *(extend preset/harness)* |
| F30-06 | task | `verified-gap`: no `getCurrentContextWithMetadata` / `clearContext` handlers | `add-fdc3-3-0-channel-metadata-apis` |
| F30-07 | task | `verified-partial`: `CloseRequestMessage` local type; `@finos/fdc3` ^2.2.3 in package.json | `add-fdc3-3-0-local-types-and-dep-upgrade` |
| F30-08 | task | `verified-gap`: only `close.feature` tagged `@conformance3.0` per failure review doc | `expand-conformance3-0-bdd-coverage` |
| F30-09 | task | `verified-partial`: `fdc3Version: "2.2"` in `sail-default-config.ts`; WCP defaults same | `configurable-fdc3-version-advertisement` |
| F30-10 | task | `investigate`: 3.0 toolbox pack + `@finos/fdc3` 3.x client availability | `record-fdc3-3-0-toolbox-baseline` |
| F30-11 | task | `verified-gap`: no dual-version doc in `website/docs/` | `document-fdc3-2-2-3-0-dual-version` |
| F30-00 | epic | coordinates F30-01–11 | `epic-fdc3-3-0-dual-version` |

## Parent context summary

Sail targets **FDC3 2.2** today (`fdc3Version: "2.2"`, `@finos/fdc3` ^2.2.3). **3.0 is incremental on one DACP tree** — not a fork. **`fdc3.close()` / `closeRequest` is already implemented** with `@conformance3.0` BDD. **Supporting both versions** means wire-forward optional metadata, keeping 2.2 conformance green, and flipping advertised `fdc3Version` only after 3.0 toolbox proof — not running two agents. **npm `3.0.0-pre.x` is product semver**, not FDC3 spec level. **Priority:** finish v5 2.2 harness teardown before attributing open-with-context timeouts to 3.0. **Next Must tasks:** audit delta (F30-01), open metadata wire (F30-03), types strategy (F30-07).

## Work item retention

Delivered work item `.md` files are **deleted** after delivery; this section and `plans/project-docs.md` **Delivered work index** are the durable record.
