# Parked: context interception (PII redaction / policy)

Status: parked idea — not planned, not scheduled
Raised: 2026-07-30, during the `SailPlatform` design interview

## The idea

An interceptor sits in the DACP path and can **modify or block** a context before it is delivered.
Motivating case: redact PII from a context before a `broadcast` lands with the receiving apps, or
before an `intentEvent` reaches a target app. Policy could be static rules or an AI judgement.

## Why it is parked

Every other capability on the `sail-platform` list is served by one of two seams that need no
interception:

- **config in** — entitlements and auth resolve before boot and arrive as a filtered app directory
- **events out** — an FDC3-operation-level event stream serves audit, telemetry, and an observing AI

Interception is the **only** requirement identified that would justify a middleware pipeline inside
the agent. Confirmed 2026-07-30: the AI observer case does **not** need to block anything today —
observe and act as a normal FDC3 app is sufficient.

## Why it is worth writing down now

If this ever becomes real, it changes an architectural decision rather than adding a feature:

- It must sit **inside** the DACP handler path — the agent deliberately exposes no transport seam
  (`src/index.ts`: "There is no transport abstraction to configure").
- It is a **trust boundary**, so it must fail closed. An interceptor that throws must not silently
  deliver the original context.
- It affects every context-bearing operation: `broadcast`, `intentEvent`, `intentResult`, and
  `open`-with-context. Retrofitting it to one and not the others produces a redaction bypass.
- It is the difference between "the agent emits events" (additive, cheap, reversible) and "the agent
  has a pluggable pipeline" (a public extension contract, a semver commitment, an ordering problem).

## Trigger to revisit

A named adopter who needs a context modified or blocked in flight — not a hypothetical one. Until
then the event stream covers the observable half, and this stays parked.

## Related

- `.cursor/plans/website-docs-blueprint.md` — slice 0 design session that surfaced this
- `.cursor/plans/sail-platform-extensibility.md` — earlier decision: "build nothing yet, fix defects"
- `ARCHITECTURE-REMEDIATION-PLAN.md` W7 — the WCP state machine work, adjacent to any DACP-path change
