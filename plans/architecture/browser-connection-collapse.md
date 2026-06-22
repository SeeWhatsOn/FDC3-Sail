# Browser connection collapse — target structure

## Goal

Hide WCP + MessagePort plumbing inside `DesktopAgent`. One public broker; connection map is runtime-only, not AgentState.

## Target `src/` tree

```
src/
  index.ts
  agent/
    desktop-agent.ts
    create-browser-desktop-agent.ts
    browser-session.ts
    default-config.ts
  connections/
    types.ts
    app-connection-manager.ts
    browser/
      browser-connection-backend.ts
      message-port.ts
      wcp/
  dacp/
  handlers/
  state/
  app-directory/
  host-contracts/
  testing/
```

## Message flow

```
postMessage (WCP1–3) → BrowserConnectionBackend → AppConnectionManager (port map)
MessagePort (DACP)   → enrich meta.source → DesktopAgent.ingest() → handlers → state
handlers reply       → deliverToApp(instanceId) → port
```

## Removed

- `DaOwnedAppConnectionRouter` — loopback Transport demuxer
- `BrowserDaEdgeLink` — twin Transport pair
- Public `WCPConnector` host wiring

## Status

- [x] `connections/types.ts` — `BrowserConnectionBackend`, `AppConnectionDelivery`
- [x] `AppConnectionManager` — port map + `deliverToApp`
- [x] Direct ingest/deliver (no Transport loopback)
- [x] `BrowserConnectionBackend` replaces `WCPConnector` + router
- [x] Deleted `DaOwnedAppConnectionRouter`, `BrowserDaEdgeLink`
- [ ] Folder migration (`agent/`, move `app-connection/wcp` → `connections/browser/wcp`)
