# PRD: Transport lifecycle and platform API hardening

## Persona / user

- **Sail platform engineers** maintaining browser Desktop Agent, WCP iframe apps, and `@finos/sail-platform-api`.
- **Custom-style dashboard integrators** running up to ~30 widget identities with FDC3 as control plane (intents, channels, context), not as a market-data bus.

## Goal / outcome

Harden in-process and MessagePort transports and replace raw DACP impersonation in the platform API so disconnect/reconnect and iframe churn are reliable, observable, and authority-safe.

## In scope

1. **InMemoryTransport**: symmetric disconnect (no half-open peers); clearer send-failure behavior; lifecycle tests; accurate runtime/docs claims.
2. **MessagePortTransport + WCP**: no duplicate `appDisconnected`; port always closed on error disconnect; listeners actually removed; deliberate `messageerror` policy.
3. **Platform API**: remove or replace `sendDACPMessageOnBehalfOf` with intention-level APIs (e.g. set app channel); typed validation; lifecycle guards; align with WCP routing where dispatch is needed.

## Out of scope

- Streaming / high-frequency payloads over FDC3 or transport batching/backpressure (document constraint only).
- New external tracker IDs or GitHub issue creation in this planning phase.
- Production code or executable tests in planning artifacts.

## Success criteria

- After `disconnect()` on either side of an in-memory pair, both endpoints report disconnected and cannot send; browser agent stop/start reuse passes tests.
- Send path does not report success when clone/delivery will fail without a documented best-effort contract.
- WCP explicit and error disconnect paths emit at most one `appDisconnected` per instance and always close the MessagePort and detach listeners.
- Platform consumers cannot send arbitrary `unknown` DACP as any app; channel changes use typed, lifecycle-aware APIs with Promise-based outcomes.
- Existing Vitest/WCP tests updated; no regression in default `createBrowserDesktopAgent()` flows.

## BDD scenarios (product-level)

```text
Given an in-memory transport pair connecting agent and platform
When one endpoint calls disconnect()
Then both endpoints are disconnected, peer references cleared, and each disconnect handler ran once

Given a MessagePort app connection in WCP
When the platform calls disconnectApp for that instance
Then appDisconnected fires once and the port is closed with listeners removed

Given a MessagePort postMessage failure
When the transport handles the error
Then WCP maps are cleared, the port is closed, and disconnect handlers do not leave the port open

Given a started Sail browser platform
When UI calls setAppChannel(instanceId, channelId)
Then the agent updates channel membership via validated app-originated flow without raw DACP impersonation from platform-api

Given platform not started
When UI attempts a channel mutation API
Then the call rejects before mutating Desktop Agent state
```

## Risks / unknowns

- Whether any consumer still depends on `sendDACPMessageOnBehalfOf` outside the repo (grep + human confirm).
- Whether `messageerror` should be fatal for Sail security vs. tolerate malformed single messages.
- Breaking change surface for `@finos/sail-platform-api` public types.

## Constraints

- FDC3 2.2 / DACP protocol shapes in `dacp-messages.ts`.
- AGENTS.md: no test-only production APIs; prefer `disconnectInstance` / WCP paths in BDD.
- Packages: `@finos/sail-desktop-agent`, `@finos/sail-platform-api`, consumers in `@finos/sail-web` if referenced.

## Suggested vertical slices

See `plans/work-items/` — ordered by dependency in handoff report.

## Reference

- Source findings: `.cursor/issues-discovered.md`
