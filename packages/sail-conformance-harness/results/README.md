# Harness toolbox results

FINOS FDC3 conformance toolbox exports and attribution notes for `@finos/sail-conformance-harness`.

**Important:** `conformance-report-vN.txt` filenames are **report export iterations**, not FDC3 spec versions. Check the harness log line `FDC3 target: …` (from `HARNESS_FDC3_TARGET_VERSION` in `src/harness-bootstrap.ts`) for the advertised runtime version under test.

| File | Role |
|------|------|
| `conformance-report-v6.txt` | Latest measured export (53 pass / 26 fail) — mixed 2.2 + 3.0 toolbox rows |
| `conformance-report-v5.txt` | Previous measured export (53 pass / 49 fail) |
| `conformance-report-v4.txt` | Previous measured export (31 / 64) |
| `conformance-report-v3.txt` | First harness clean-room export (15 / 45) |
| `conformance-test-failure-review.md` | Live attribution matrix and work-item mapping |

Save the next full toolbox export as the next `conformance-report-vN.txt` and update `conformance-test-failure-review.md`.

Removed (2026-06): `conformance-report.txt`, `conformance-report-v2.txt` — early **sail-finance** `:3000` runs, not harness clean-room.
