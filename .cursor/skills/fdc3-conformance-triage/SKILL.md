---
name: fdc3-conformance-triage
description: Triages FINOS FDC3 toolbox conformance report files (conformance-report-v*.txt), classifies failures by layer (product, BDD, WCP, harness), and recommends fixes plus regression tests (Vitest, Cucumber, WCP integration, Playwright). Use when the user provides conformance results, asks how to guard against conformance regressions, or wants a test-hardening plan after a harness/toolbox run.
---

# FDC3 Conformance Triage

Turn a toolbox export into: **what broke → why → fix product vs add tests → which test layer**.

## Inputs

Ask for or locate:

| Input | Typical path |
|-------|----------------|
| Conformance export | `packages/sail-conformance-harness/artifacts/conformance.json` (from `npm run test:conformance`) |
| App directory oracle | `conformance-appd.json` |
| Committed baseline | `packages/sail-conformance-harness/e2e/conformance-baseline-2.2.json` |
| BDD map | `website/docs/packages/desktop-agent/conformance.md` |

Parse the report header: `passes: N failures: M duration: …`

## Workflow

Copy and track:

```
- [ ] 1. Parse failures (area, scenario, symptom, cause line)
- [ ] 2. Classify each failure (table below)
- [ ] 3. Decide product fix vs test gap vs harness/host
- [ ] 4. Pick regression layer (Vitest / Cucumber / WCP / Playwright / toolbox re-run)
- [ ] 5. Output triage table + ordered work items
```

### Step 1 — Extract failures

Group by `fdc3.*` section. For each failing row capture:

- **Scenario name** (e.g. `FindIntentAppD`, `UCBasicUsage1`)
- **Symptom**: `AppTimeout`, `IntentDeliveryFailed`, `UserCancelledResolution`, deep-equal, wrong length, missing property, wrong error `message`
- **Cause line** if present (after `Cause:` or `Documentation:`)

### Step 2 — Classify (use this table)

| Symptom / pattern | Layer | Product fix? | Best regression net |
|-------------------|--------|--------------|---------------------|
| `findIntent` / `findIntentsByContext` deep-equal, `displayName`, `apps.length` | **Agent + oracle** | Often yes (dedupe, directory mapping) | Vitest with `conformance-appd.json`; Cucumber `@conformance2.2` + **same assertions as toolbox** |
| `getAppMetadata` / `AppInstanceMetadata` missing `desktopAgent` or field | **Agent + oracle** | Often yes | Cucumber `apps.feature`; Vitest `app-metadata-desktop-agent` |
| Wrong error `message` (`NoAppsFound` vs `IntentDeliveryFailed` / `assert.fail()`) | **Agent** | Yes | Vitest error-boundary table; BDD throws scenarios |
| `getResultMetadata` empty / metadata on intent result | **Agent** | Yes | Vitest + Cucumber intent-result scenarios |
| **`AppTimeout`** on open-with-context, user/app channels, context metadata | **Integration** (WCP, instance id, iframe) | Sometimes agent open/targeting; often host | WCP Vitest (`wcp-desktop-agent.integration`); harness/Playwright smoke — **mock BDD alone will not catch** |
| **`IntentDeliveryFailed`** on raiseIntent / basicRI / private channel | **Integration** | Mixed | WCP integration; Cucumber only if steps model **real** instance correlation (`uuid-0`); harness E2E |
| **`UserCancelledResolution`** on raiseIntent (Result) | **Host / resolver** | Harness/web auto-resolve | Not mock Cucumber — fix conformance harness or sail-finance resolver profile |
| `findInstances` missing instance / `IntentDeliveryFailed` | **Integration** | Often instance lifecycle | WCP host-id bind tests; harness `findInstances` slice |
| `GetInfo2` timeout | **Integration** | App bootstrap / connection | Harness/WCP integration; not MockTransport-only |
| Improved open no-context but context paths timeout | **Integration** | Instance + delivery | Same as AppTimeout |

**Rule:** If failure only happens with **two browser apps + WCP + timeouts**, do not expect more **MockTransport** Cucumber to fix conformance — add **WCP or Playwright/harness** guards after product fix.

**Rule:** If failure is **shape/count/metadata** on DACP responses, **Vitest + Cucumber + conformance-appd.json** is the right guard.

### Step 3 — Three-layer truth (do not conflate)

| Layer | What green means |
|-------|------------------|
| **Vitest + Cucumber** (`MockTransport`) | Agent DACP + directory logic on simplified host |
| **WCP + InMemory** (Vitest jsdom) | Production connector path in one process |
| **Toolbox / harness** (`:3001`) | Full stack oracle — authoritative for release |

`@conformance2.2` ≠ toolbox pass. Say that explicitly in the triage output.

### Step 4 — Pick regression (decision tree)

```
Failure classified as AGENT + ORACLE?
  → Fix code in packages/sail-desktop-agent
  → Add Vitest (fast, table-driven)
  → Add/tighten Cucumber with conformance-appd.json + toolbox fields
  → Optional: re-run @conformance2.2 only

Failure classified as INTEGRATION?
  → Fix platform/harness/agent instance-id pipeline first
  → Add/extend WCP integration tests
  → Add thin Playwright smoke on sail-conformance-harness (subset, not full 95 scenarios)
  → Record harness re-run in conformance-test-failure-review.md

Failure classified as HOST/RESOLVER?
  → sail-conformance-harness / sail-finance — defer pure agent Cucumber
```

### Step 5 — Output format

Deliver:

```markdown
## Conformance triage — [report file] ([date])

**Baseline:** N pass / M fail (~X%)

### By category
| Category | Count | Primary layer | Action |
|----------|-------|---------------|--------|

### Per failure (top priorities first)
| Scenario | Symptom | Class | Product fix? | Regression to add |
|----------|---------|-------|--------------|-------------------|

### What NOT to do
- [ ] e.g. "Don't add MockTransport Cucumber for UCBasicUsage1 AppTimeout"

### Suggested order
1. …
2. …

### CI recommendation
- PR: vitest + cucumber (sail-desktop-agent)
- Merge/release: harness smoke or full toolbox export compare to baseline
```

## Repo commands (reference)

```bash
npm test -w @finos/sail-desktop-agent          # vitest + cucumber
npm run test:cucumber -w @finos/sail-desktop-agent
npx cucumber-js --tags "@conformance2.2" -w @finos/sail-desktop-agent
npm run dev -w @finos/sail-conformance-harness   # :3001 manual toolbox
```

## Hardening checklist (when adding guards)

- [ ] Load **`conformance-appd.json`** in test fixture (not only synthetic Gherkin apps)
- [ ] Assert **toolbox fields**: `intent.displayName`, `AppIntent.apps.length`, `AppMetadata.desktopAgent`, error `.message`
- [ ] Align Vitest oracle with toolbox (no test that expects wrong count vs FINOS)
- [ ] For delivery failures: assert **destination.instanceId** in WCP tests, not only DACP type
- [ ] Update `website/docs/packages/desktop-agent/conformance.md` row from `partial` → `covered` only when the new guard matches toolbox symptom

## Anti-patterns

- Treating green Cucumber as conformance pass
- Adding BDD scenarios that duplicate MockTransport happy path without new oracle fields
- Full Playwright reimplementation of entire toolbox (use **smoke subset** + periodic full run)

## More detail

See [reference.md](reference.md) for symptom glossary and example triage row.
