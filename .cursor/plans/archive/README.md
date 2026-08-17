# Archive

Point-in-time records: plans that are superseded, landed, or fully closed. Kept for history —
**do not work from these.** Each file carries an `ARCHIVED` header (date, reason, where any live
work went). If a file here still had open items when it was archived, those items were either
re-verified as already resolved (with evidence, in place) or carried forward into a live plan
under `.cursor/plans/` — nothing was dropped silently.

For current work, start at [`.cursor/plans/README.md`](../README.md).

## Batches

**2026-08-07** — four superseded plans: `sail-one-port.md`, `sail-platform-design.md`,
`sail-platform-kiss-entry.md`, `website-docs-defect-register.md`. Mostly casualties of the
2026-08-04 `sail-platform` cull.

**2026-08-14** — nine landed plans, the batch the 2026-08-07 pass named as "next" and left in place:

| File | Why |
|---|---|
| `dacp-handler-deps-refactor.md` | All slices done; slice 4 cut |
| `typescript-strictness-rollout.md` | All 7 slices done |
| `sail-da-test-suite-realignment.md` | All 6 slices done |
| `sail-desktop-agent-review-remediation.md` | Slices 0–11 done |
| `sail-desktop-agent-surface-reduction.md` | All 3 phases done |
| `sail-desktop-agent-class-collapse.md` | All slices landed — and committed, despite its old header |
| `mvd-sail-da-slice-a.md` | Delivered in `8a62fd386` — likewise mis-labelled "Uncommitted" |
| `sail-da-defect-fixes.md` | All 4 slices done |
| `reusable-browser-host-kit.md` | Slice A done and now better documented on the website; slice B parked |

Their surviving open items are in [`../open-items.md`](../open-items.md).

Three claims in that batch did **not** survive re-verification and are corrected in `open-items.md`
rather than in the archived text: the `startHeartbeat` "captured `temp-` id forever" defect (the
identity half does not reproduce, and a regression test already pins the correct behaviour), the
`getHandlerForMessageType` per-message closure (resolved incidentally by `98716f08`), and the
`sail-ui` / `@tailwindcss/vite` build limitations (both resolved). The archived files keep their
original wording — read `open-items.md` for what is actually true.

`dashboard-2026-08-07.html` is a rendered snapshot of what the 2026-08-07 pass found. It carries a
banner saying so. Its counts and lifecycle board are superseded by the 2026-08-14 batch above.
