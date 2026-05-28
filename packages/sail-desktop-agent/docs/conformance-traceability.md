# FDC3 2.2 conformance traceability map

This document maps FINOS FDC3 2.2 interop / conformance pack areas to in-repo Cucumber BDD scenarios under `packages/sail-desktop-agent/test/features/`. Scenarios tagged `@conformance2.2` are explicit pack alignments; **99 scenarios across 12 feature files** carry that tag (as of this map). Status is honest: `covered` means representative `@conformance2.2` scenarios exist and pass in CI; `partial` means gaps remain; `missing` means no BDD yet; `n/a` means outside the FDC3 2.2 public API conformance surface (e.g. Sail WCP transport).

| Conformance area | Feature file + scenario | Status | Notes/slug |
| DesktopAgent.getInfo / implementation metadata | `test/features/basic/basic.feature` — GetInfo returns implementation metadata; GetInfo returns optionalFeatures capability flags | covered | Also `test/features/apps/apps.feature` — getInfo returns app metadata for the requesting app |
| User channels (list, join, leave, current) | `test/features/channels/user-channels.feature` — User channels include displayMetadata for all predefined channels; Current context is delivered when joining a user channel; Broadcasting on a user channel does not echo back to the sender | covered | 14 `@conformance2.2` scenarios in `user-channels.feature`; smoke in `test/features/basic/basic.feature` — User channel can be joined and left |
| App channels (create, broadcast, listeners) | `test/features/channels/app-channels.feature` — Broadcasting context on an app channel; Multiple context types on an app channel; Channel.addContextListener does not auto-deliver prior context | partial | 9 `@conformance2.2` scenarios; context-history / ordering matrix gaps — **app-channel-context-history-bdd** |
| Private channels | `test/features/channels/private-channel.feature` — Null lifecycle listener receives addContextListener unsubscribe and disconnect events; Disconnecting from a channel sends unsubscribe and disconnect messages | covered | 4 `@conformance2.2` scenarios |
| Context broadcast (user channel) | `test/features/context/broadcast.feature` — Broadcast Event Includes OriginatingApp Metadata; Broadcast Is A No-Op When Not Joined To A User Channel | covered | Malformed-context error row covered separately below |
| Context / event listeners | `test/features/context/event-listeners.feature` — Receiving channelChanged event when another app joins a channel; addEventListener with null type subscribes to all event types | covered | Listener creation smoke in `test/features/basic/basic.feature` — Context listener for a specific type can be created |
| raiseIntent | `test/features/intents/raise-intent.feature` — Raising an intent that should auto-resolve (only one option); User Cancels The Intent Resolver Returns UserCancelledResolution; Raising An Intent With Malformed Context Returns MalformedContext | covered | 12 `@conformance2.2` scenarios in `raise-intent.feature` |
| raiseIntentForContext | `test/features/intents/raise-intent-with-context.feature` — Raising An Intent With Context To A Running App; User Cancels The Intent Resolver Returns UserCancelledResolution | covered | 9 `@conformance2.2` scenarios; smoke in `test/features/basic/basic.feature` — Intent can be raised for context |
| findIntent / findIntentByContext | `test/features/intents/find-intent.feature` — Successful Find Intents Request; Find Intents by Context Request; Find Intent With Malformed Context Returns MalformedContext | covered | 12 `@conformance2.2` scenarios |
| Intent resolution / IntentResult | `test/features/intents/intent-result.feature` — App Returns An Intent Result; IntentResolution.getResult() rejects with NoResultReturned when handler returns nothing | covered | 6 `@conformance2.2` scenarios |
| Apps (metadata, open, open with context, findInstances) | `test/features/apps/apps.feature` — Opening An App; Opening An App With Context; Find Instances with Some Apps Running; Opening An App With Malformed Context Returns MalformedContext | covered | 15 `@conformance2.2` scenarios in `apps.feature` |
| Disconnect / lifecycle cleanup | `test/features/apps/disconnect-cleanup.feature` — Apps that disconnect and reconnect to the DA should receive one copy of a broadcast message from an app channel as state was cleaned up; Disconnecting from the DA when subscribed to a private channel channel sends unsubscribe and disconnect messages | partial | P0 source/open-with-context gaps in `test/features/apps/disconnect-cleanup-p0.feature` (not `@conformance2.2`) — **extend-cleanup-source-and-open-with-context** |
| FDC3 error enums (ResolveError, OpenError, ChannelError, …) | `test/features/intents/raise-intent.feature` — Raising An Intent With Malformed Context Returns MalformedContext; `test/features/apps/apps.feature` — Opening A Missing App; `test/features/context/broadcast.feature` — Broadcast With Malformed Context Returns MalformedContext Error | partial | Many scenarios assert error names ad hoc; systematic boundary matrix — **fdc3-error-enum-boundary-tests** |
| WCP transport / browser bridge | — | partial | Cucumber uses `MockTransport`; no `@conformance2.2` WCP path — **bdd-wcp-integration-scenario** |
| Heartbeat / liveness (Sail infrastructure) | `test/features/infrastructure/heartbeat.feature` — App Responds to heartbeats; App Doesn't Respond to heartbeats | n/a | WCP6 heartbeat is Sail transport hygiene, not FDC3 2.2 public API pack; test hygiene — **audit-heartbeat-disconnect-cleanup** |

## Tag inventory (`@conformance2.2`)

- `test/features/basic/basic.feature` — 10
- `test/features/channels/user-channels.feature` — 14
- `test/features/channels/app-channels.feature` — 9
- `test/features/channels/private-channel.feature` — 4
- `test/features/context/broadcast.feature` — 3
- `test/features/context/event-listeners.feature` — 2
- `test/features/intents/raise-intent.feature` — 12
- `test/features/intents/raise-intent-with-context.feature` — 9
- `test/features/intents/find-intent.feature` — 12
- `test/features/intents/intent-result.feature` — 6
- `test/features/apps/apps.feature` — 15
- `test/features/apps/disconnect-cleanup.feature` — 3

**Total: 99** tagged scenarios across 12 feature files.

Files without `@conformance2.2` tags: `test/features/infrastructure/heartbeat.feature`, `test/features/apps/disconnect-cleanup-p0.feature` (lifecycle P0, not pack-tagged).
