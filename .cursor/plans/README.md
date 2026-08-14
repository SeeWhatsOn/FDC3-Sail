# Sail plans

Ad-hoc MVD/lite delivery plans, per `AGENTS.md`. **Plans are ephemeral** — they hold reasoning and
decisions, not code comments. The formal Watson `plans/` queue is retired; do not recreate it.

**Live plans are in this directory. Everything in `archive/` is a point-in-time record — do not work
from it.** Every archived file carries an `ARCHIVED` header saying why it was closed and where any
open items went.

Last pruned **2026-08-14**, verified against `a6c6b62`/`d49abb8d`. Nine plans were archived, the two
root working documents (`ARCHITECTURE-REMEDIATION-PLAN.md`, `FDC3-SAIL-REVIEW.md`) were deleted after
their orphaned findings were carried across, one backlog file was created, and every claim below was
re-checked against the tree by reading the cited source — not by trusting the plans' own status
lines. Several did not survive that check; the corrections are recorded in place.

**CI was red in five separate ways.** All are fixed and the whole chain is verified green from a
clean `dist` — see [`open-items.md` §0](open-items.md) for what each was and why it hid.

---

## Start here

| If you want to… | Read |
|---|---|
| Pick up the highest-value DA work | [`sail-da-defect-register-2026-08-11.md`](sail-da-defect-register-2026-08-11.md) — 8 open defects, slice B is next |
| Fix the one security gap nobody was tracking | [`open-items.md` §8](open-items.md) — FDC3 app iframes render with no `sandbox`, in **both** shells |
| Know what a closed plan left behind | [`open-items.md`](open-items.md) |
| Know why something is the way it is | `archive/` — the reasoning is kept even when the plan is closed |

---

## Live plans

### Backlogs — work waiting to be picked up

| Plan | State | Next step |
|---|---|---|
| [`open-items.md`](open-items.md) | **live backlog** | Everything carried out of the nine archived plans and the two deleted root docs. §0 records the three CI failures (now fixed); §8 holds the orphaned findings, including the iframe `sandbox` gap. |
| [`sail-da-defect-register-2026-08-11.md`](sail-da-defect-register-2026-08-11.md) | **live — 8 of 10 open** | #1 and #2 are fixed (`8a62fd386`). Slice B — #3, #5, #6, intent-routing correctness. #3 already has a written, skipped Prove-It test: unskip it and make it pass. |
| [`sail-desktop-agent-audit-2026-08.md`](sail-desktop-agent-audit-2026-08.md) | **live — analysis holds, some addresses dead** | The whole §10 park list is still present in the tree. See Revision 3 before using any `file:line` from §5.1, §5.6, §6.1, §6.2 or §7. |
| [`website-docs-blueprint.md`](website-docs-blueprint.md) | **live — slices 0–5 done, 6 open** | `docs:build` is fixed, so link-checking runs again. Slice 6 is now just snippet compilation. Four named doc defects remain; fixing them unlocks `onBrokenAnchors: "throw"` as a one-line guardrail. |

### Designed but unstarted

| Plan | State | Next step |
|---|---|---|
| [`agent-observability-seam.md`](agent-observability-seam.md) | **planning, slice 1 not begun** | Design is sound; **the line references are not**. 19 of 24 have drifted, one is past EOF, and one is the wrong file in a way that breaks Slice 2's premise. Do a reference pass and re-scope Slice 2 first. |

### Registers and decision records — not work orders

| Plan | State | What it is for |
|---|---|---|
| [`draft-pr-readiness.md`](draft-pr-readiness.md) | standing review artifact — **~23 of 32 rows still live** | "Could this be opened as a draft PR to `finos/FDC3-Sail`" — oversight across 32 areas. Nothing here is committed work. Re-verified 2026-08-14: **only 3 of 7 blockers remain** (0, 3, 29 — all release hygiene, no code). Items 7, 9, 10 and 11 are resolved; rows 15/19/28 have updated evidence. |
| [`sail-desktop-agent-feature-decisions.md`](sail-desktop-agent-feature-decisions.md) | open register, 1 item | `ChannelControl` — keep or delete. Still zero call sites; it has already produced one wrong public doc. |
| [`sail-platform-extensibility.md`](sail-platform-extensibility.md) | decision record | Holds the **negative** decisions — what we deliberately will not build — so they are not quietly re-litigated. §2 still matches the code. |

### Parked — deliberately not scheduled

| Plan | Why parked |
|---|---|
| [`parked-context-interception.md`](parked-context-interception.md) | The only requirement that would justify a middleware pipeline inside the agent. No current need; would change an architectural decision, not add a feature. |
| [`parked-wcp4-origin-allowlist.md`](parked-wcp4-origin-allowlist.md) | Removed from code in the 2026-08-04 cull — it was never used and lived in the wrong package. Kept as the acceptance criteria for any reimplementation. |

Both were re-verified accurate on 2026-08-14: the symbols stay deleted and no interception seam
exists in the DACP path. Both are linked from `website/docs/` — **do not move them** without
updating those links.

---

## Conventions

- **One home per item.** If work lives in a live plan it stays there; `open-items.md` only holds what
  would otherwise have been lost to archiving, and points at the live plans for the rest.
- **Archive when the work lands**, with an `ARCHIVED` header: date, reason, evidence, and where any
  open items went. Never archive a plan with open items unless they are re-verified resolved (with
  evidence) or carried forward.
- **Correct a stale claim in place, and say so.** Several plans carried confident statements that
  turned out to be false. Strike them through and give the evidence rather than deleting them — the
  wrong reasoning is often why a later decision looks odd.
- **`wip/v3-local` is not the baseline any more.** Plans written before 2026-08-08 cite it as their
  branch base; it is now 38 commits behind. Verify against the current tip.
- Plans reference worktrees under `.claude/worktrees/` that no longer exist. Harmless, but do not
  expect to find them.
