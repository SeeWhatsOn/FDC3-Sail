# FDC3 Conformance Triage — Reference

## Symptom glossary

| Symptom | Usually means |
|---------|----------------|
| `AppTimeout` | Target app never received context/listener in time — routing, instance id, or app not connected |
| `IntentDeliveryFailed` | Intent raised but listener/instance mismatch or app not ready |
| `UserCancelledResolution` | Resolver not auto-selecting (harness/UI), not missing handler |
| `TargetInstanceUnavailable` | Instance id not in agent state |
| `NoAppsFound` expected but `assert.fail()` | Error not mapped to FDC3 `ResolveError` on client |
| `expected … length of 1 but got 2` | Directory + running listener dedupe in `findIntent` / `findIntentsByContext` |
| `deeply equal` on intent | `displayName` or intent object shape vs `conformance-appd.json` |
| `to include 'desktopAgent'` | `AppMetadata` missing provider field |
| `expected '' not to equal ''` | `getResultMetadata` not populated on result path |

## Test layer capabilities

| Layer | Catches | Does not catch |
|-------|---------|----------------|
| Vitest unit/handler | Logic, enums, metadata mapping with appd fixture | Cross-origin iframes, real timeouts |
| Cucumber + MockTransport | DACP contracts, channel logic with wired instanceIds | Wrong instanceId from launcher/WCP4 |
| Cucumber + conformance-appd | Directory-shaped bugs | AppTimeout clusters |
| Vitest WCP + jsdom | WCP4→5, connector, host instance bind | Full FINOS iframe apps |
| Harness :3001 + toolbox | Full oracle | Slow; headless export flaky |
| Playwright on harness | Headless E2E slices of above | Maintenance cost |

## Example triage row

**Input (from report):**

```
(FindIntentAppD) Should find intent 'aTestingIntent' ...
Unexpected AppIntent.apps.length. Expected 1, got 2
```

**Classification:**

- Layer: Agent + oracle
- Product: dedupe directory vs running listener in `createAppIntents`
- Regression: extend `intent-discovery-metadata.test.ts` to expect **1** app for this scenario; Cucumber scenario with `conformance-appd.json` and `apps.length` column
- Not sufficient: another generic `Successful Find Intents Request` on synthetic apps only

## v3 → v4 movement (context)

Use when comparing reports:

- Open without context often improves with host↔WCP instance bind
- findIntent deep-equal often improves with displayName/dedupe fixes
- AppTimeout volume may stay high until integration tests exist — do not mark BDD "done" on channels only from MockTransport green
