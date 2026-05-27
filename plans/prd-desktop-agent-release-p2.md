# PRD: Desktop Agent release P2 (hardening, docs, and platform pointers)

## Persona / user

- **Lead maintainer** scheduling post-P1 release hardening for `@finos/sail-desktop-agent`.
- **Security / compliance reviewers** expecting metadata-only DACP/WCP logging and accurate public docs.
- **Platform engineers** owning `@finos/sail-platform-api` integration (Task 6 — not implemented in this PRD’s work items).

## Goal / outcome

Index deferred desktop-agent items (remediation Tasks 4–5, compliance optional cleanup) and platform-owned integration (Task 6) so nothing lives only in chat or the remediation checklist. Produce draft work items for desktop-agent P2-01–P2-05; point P2-10–P2-12 at platform without duplicating full specs.

## Relationship to other plans

| Existing plan | Status on `v3-pre` | This PRD |
|---------------|-------------------|----------|
| `plans/prd-desktop-agent-conformance-gaps.md` (P1) | Draft work items; P0 cleanup in PR #14 | **No duplicate** — P1 owns conformance BDD, WCP policy, history cap, traceability. See P1 for items 3–11. |
| `FDC3_2_2_REMEDIATION_PLAN.MD` Task 4 (logging) | Not done | **P2-01** — same goal, desktop-agent package |
| `FDC3_2_2_REMEDIATION_PLAN.MD` Task 5 (README / package drift) | Not done | **P2-02** — same goal |
| `FDC3_2_2_REMEDIATION_PLAN.MD` Task 6 (platform integration) | Not done | **P2-10–12** — platform-owned; reference only |
| `plans/prd-transport-platform-hardening.md` | 8 draft transport work items | **No duplicate** — MessagePort / InMemory / impersonation stay in transport PRD |
| P0 `extend-cleanup-source-and-open-with-context` | Implemented in PR #14 | **Prerequisite** for P1 sign-off; not re-planned here |

**See also:** `plans/prd-desktop-agent-conformance-gaps.md` for P1 conformance and lifecycle items deferred from this release wave.

## In scope (desktop-agent — P2-01 … P2-05)

| ID | Topic | Kind | Evidence (v3-pre) |
|----|--------|------|-------------------|
| P2-01 | DACP/WCP log redaction (metadata-only) | task | `verified-gap`: `message-port-transport.ts` logs `fullMessage: JSON.stringify(...)`; intent handlers log `JSON.stringify(contextPayload)` |
| P2-02 | README / package name / validation docs | task | `verified-gap`: `packages/sail-desktop-agent/README.md` may still reference old package name / Zod claims (per remediation Task 5) |
| P2-03 | Centralize `getInfo` / implementation metadata version defaults | task | `verified-partial`: `desktop-agent.ts` defaults `providerVersion` `3.0.0`; `wcp-handlers.ts` `0.0.1`; `app-handlers.ts` `0.0.0` (`FDC3_2_2_COMPLIANCE_REVIEW.MD`) |
| P2-04 | ListenerError string casts at handler boundaries | task (coordinate) | `verified-partial`: compliance review flags `"ListenerError" as ChannelError`; **coordinate with P1** `fdc3-error-enum-boundary-tests` — do not duplicate enum matrix work |
| P2-05 | In-memory transport tests: explicit promises vs fixed sleeps | spike/task | `verified-gap`: `in-memory-transport.test.ts` uses `setTimeout(200)` wait |

## Platform pointers (not desktop-agent work items here)

| ID | Topic | Owner | Remediation ref |
|----|--------|-------|-----------------|
| P2-10 | Platform integration contract tests | `@finos/sail-platform-api` | Task 6 |
| P2-11 | Always inject validator in production `SailPlatform` | platform-api | Task 6 / compliance “Needs platform integration” |
| P2-12 | `getAgent()` / destructured method binding tests | platform-api | Task 6 / proxy layer |

## Out of scope

- P1 conformance items (history cap, WCP allowlist, traceability map, BDD gaps) — `plans/prd-desktop-agent-conformance-gaps.md`
- Transport MessagePort / InMemory hardening — `plans/prd-transport-platform-hardening.md`
- Electron `sail-electron` proxy import
- Repo-wide ESLint / Prettier
- FDC3 3.0 `Channel.clearContext()` / `contextCleared` (not 2.2 blocker per remediation plan)
- Re-opening remediation Tasks 1–2 or P0 cleanup (unless regression)

## Success criteria

- Logger tests prove sensitive fields (e.g. fake `accountNumber`) never appear in default DACP/WCP logs.
- README and `src/index.ts` examples use `@finos/sail-desktop-agent` and describe injectable validation.
- Single documented source for `implementationMetadata` version defaults; `getInfo` responses consistent in BDD.
- P2-04 changes land with or after P1 `fdc3-error-enum-boundary-tests` without conflicting assertions.
- In-memory transport tests use deterministic synchronization (no arbitrary 200ms sleep) or spike documents why timing remains.
- Platform Task 6 tracked via remediation checklist; no duplicate platform specs in desktop-agent work items.

## Suggested work item slugs

| ID | Slug | Kind |
|----|------|------|
| P2-01 | `dacp-wcp-log-redaction` | task |
| P2-02 | `align-readme-package-and-validation-docs` | task |
| P2-03 | `centralize-implementation-metadata-defaults` | task |
| P2-04 | (coordinate with `fdc3-error-enum-boundary-tests`) | — |
| P2-05 | `fix-in-memory-transport-test-timing` | spike |

## PRD accuracy gate (2026-05-27 / v3-pre)

| ID | Classification | Evidence | Work item slug |
|----|----------------|----------|----------------|
| P2-01 | task | verified-gap: `packages/sail-desktop-agent/src/browser/wcp/message-port-transport.ts` (`fullMessage`); `intent-raise-intent.ts` context JSON logging | `dacp-wcp-log-redaction` |
| P2-02 | task | verified-gap: remediation Task 5 acceptance criteria; README path | `align-readme-package-and-validation-docs` |
| P2-03 | task | verified-partial: `FDC3_2_2_COMPLIANCE_REVIEW.MD` providerVersion inconsistencies; `app-handlers.ts`, `wcp-handlers.ts`, `desktop-agent.ts` | `centralize-implementation-metadata-defaults` |
| P2-04 | task (coordinate) | verified-partial: compliance review ListenerError casts | `fdc3-error-enum-boundary-tests` (P1) |
| P2-05 | spike | verified-gap: `in-memory-transport.test.ts` line ~267 `setTimeout(200)` | `fix-in-memory-transport-test-timing` |
| P2-10 | deferred (platform) | remediation Task 6 | — |
| P2-11 | deferred (platform) | compliance platform integration | — |
| P2-12 | deferred (platform) | compliance `getAgent()` binding | — |

Gate: **pass** — no row re-plans completed P1/P0 work; platform items explicitly deferred.

## Commands

```bash
nvm use 24
npm install
npm run validate -w @finos/sail-desktop-agent   # after P2-02 docs
npm test -w @finos/sail-desktop-agent             # after P2-01, P2-05
```
