# FDC3 Sail Code Review

**Date:** 2024-12-14
**Scope:** Browser-based FDC3 2.2 Desktop Agent implementation
**Focus:** Integration chain `apps/sail` → `packages/sail-api` → `packages/desktop-agent`

---

## Executive Summary

The codebase has a well-designed architecture with clear separation of concerns. All **critical** and **high priority** bugs have been fixed. The browser Desktop Agent should now be functional for demo.

| Priority | Status | Description |
|----------|--------|-------------|
| **CRITICAL** | 3/3 FIXED | FDC3 messaging now works |
| **HIGH** | 3/3 FIXED | Core functionality restored |
| **MEDIUM** | 2/3 FIXED | Issues affecting user experience (1 UI feature pending) |

---

## CRITICAL Issues - ALL FIXED

### 1. Instance ID Not Extracted from Messages - FIXED

**Location:** `packages/desktop-agent/src/core/desktop-agent.ts`

**Problem:** The `createHandlerContext()` method was getting `instanceId` from `transport.getInstanceId()`, which always returned `null`.

**Fix Applied:**
- Added `extractInstanceId()` method to get instanceId from `message.meta.source.instanceId`
- Updated `handleMessage()` to extract instanceId before routing
- Updated `createHandlerContext()` to accept instanceId as parameter

```typescript
// NEW: Extract instanceId from message metadata
private extractInstanceId(message: unknown): string {
  const messageObj = message as { meta?: DACPMessageMeta }
  return messageObj.meta?.source?.instanceId || ""
}

private async handleMessage(message: unknown): Promise<void> {
  const instanceId = this.extractInstanceId(message)
  const context = this.createHandlerContext(instanceId)
  await routeDACPMessage(message, context)
}
```

---

### 2. Context Broadcast Routing Broken - FIXED

**Location:** `packages/desktop-agent/src/core/handlers/dacp/context-handlers.ts`

**Problem:** `notifyContextListeners()` tried to use `instance.transport.send()`, but `instance.transport` was never set.

**Fix Applied:**
- Changed to use `handlerContext.transport.send()` instead
- Removed the broken `&& instance.transport` check
- Messages now route through WCPConnector which uses `meta.destination.instanceId`

```typescript
// BEFORE (broken)
if (listensForType && instance.transport) {
  instance.transport.send(contextEventWithRouting)
}

// AFTER (fixed)
if (listensForType) {
  handlerContext.transport.send(contextEventWithRouting)
}
```

---

### 3. WCP Instance ID Migration Never Called - FIXED

**Location:** `packages/desktop-agent/src/browser/wcp-connector.ts`

**Problem:** `updateConnectionMetadata()` existed but was never called, so connections remained keyed by `temp-{uuid}` instead of the actual instanceId.

**Fix Applied:**
- Added `transportToInstanceId` reverse lookup map
- Modified `handleDesktopAgentMessage()` to intercept WCP5 responses and call `updateConnectionMetadata()`
- Updated `bridgeTransports()` to use dynamic instanceId lookup instead of captured closure value

```typescript
// Intercept WCP5ValidateAppIdentityResponse to migrate temp→actual instanceId
if (messageType === "WCP5ValidateAppIdentityResponse") {
  const payload = messageObj.payload as Record<string, unknown> | undefined
  const actualInstanceId = payload?.instanceId as string | undefined
  const appId = payload?.appId as string | undefined

  if (actualInstanceId && appId && destinationId !== actualInstanceId) {
    this.updateConnectionMetadata(destinationId, actualInstanceId, appId)
    // Route to actual instanceId...
  }
}
```

---

## HIGH Priority Issues - ALL FIXED

### 4. No Channel State → Panel Title Reactivity - FIXED

**Location:** `packages/desktop-agent/src/browser/wcp-connector.ts`, `apps/sail/src/stores/connection-store.ts`, `apps/sail/src/components/layout-grid/panel-templates/FDC3IframePanel.tsx`

**Problem:** Panel titles only showed connection status, not the app's current FDC3 channel.

**Fix Applied:**
- Added `channelChanged` event to `WCPConnectorEvents`
- WCPConnector now intercepts `channelChangedEvent` messages and emits UI event
- Connection store listens for event and updates `connection.channelId`
- FDC3IframePanel shows channel in title: `AppName [channel-id] 🟢`

```typescript
// Panel title now shows channel
api.setTitle(`${panel.title}${channelIndicator} ${statusIndicator}`)
// Example: "Broadcaster [fdc3.channel.1] 🟢"
```

---

### 5. Connection-to-Panel Linking is Unreliable - FIXED

**Location:** `packages/desktop-agent/src/browser/wcp-connector.ts`, `apps/sail/src/stores/connection-store.ts`

**Problem:** `registerPanel()` tried to link by `appId`, which fails when multiple panels have the same appId.

**Fix Applied:**
- Added `panelId` field to `AppConnectionMetadata`
- WCPConnector extracts `panelId` from `event.source.name` (the iframe's `name` attribute)
- Connection store uses `panelId` directly instead of matching by appId
- Deterministic linking: iframe name → WCP1 → metadata → connection

```typescript
// Extract panelId from iframe's name attribute
const sourceWindow = event.source as Window
const panelId = sourceWindow.name || undefined

const metadata: AppConnectionMetadata = {
  // ...
  panelId,  // Reliable link to dockview panel
}
```

---

### 6. App Directory Not Loaded on Startup - FIXED

**Location:** `apps/sail/src/main.tsx`, `apps/sail/package.json`

**Problem:** Desktop Agent was created with `appDirectories: []`, so WCP4 validation failed.

**Fix Applied:**
- Added `@finos/fdc3-sail-example-apps` as dependency
- Import `allApplications` from manifests
- Load apps into directory at startup before starting agent

```typescript
import { allApplications } from "@finos/fdc3-sail-example-apps/manifests"

// Load example apps into the app directory
const appDirectory = sailAgent.desktopAgent.getAppDirectory()
for (const app of allApplications) {
  appDirectory.add(app)
}
console.log(`[Sail] Loaded ${allApplications.length} apps into app directory`)
```

---

## MEDIUM Priority Issues

### 7. Workspace Store Has Hardcoded Demo Data - FIXED

**Location:** `apps/sail/src/stores/workspace-store.ts`

**Problem:** Default workspace included hardcoded TradingView and Polygon panels with external URLs that won't connect via FDC3.

**Fix Applied:**
- Changed `createDefaultWorkspace()` to create an empty workspace
- Users can add FDC3 apps from the app directory

```typescript
// Start with empty panels - add FDC3 apps from directory
panels: new Map(),
```

---

### 8. No User Channel UI Integration - NOT FIXED (UI Feature)

**Location:** `apps/sail/src/components/channel-selector/`

**Problem:** Channel selector component exists but there's no visible integration in the toolbar.

**Impact:** Users can't manage channels through the UI (must use programmatic API).

**Note:** This is a UI feature enhancement, not a bug. Channel functionality works via FDC3 API.

**Recommended Fix:** Add channel selector to workspace toolbar when time permits.

---

### 9. Missing Error Handling in WCP Flow - FIXED

**Location:** `packages/desktop-agent/src/browser/wcp-connector.ts`

**Problem:** Failed WCP4 validations left stale connections in memory.

**Fix Applied:**
- Added timeout after WCP3Handshake to clean up stale connections
- If `appId` remains "unknown" after `handshakeTimeout`, connection is cleaned up
- Emits `handshakeFailed` event for UI notification
- Updated `disconnectApp()` to also clean up `transportToInstanceId` map

```typescript
// Set timeout to clean up stale connections that don't complete WCP4 validation
setTimeout(() => {
  const connection = this.connections.get(instanceId)
  if (connection && connection.appId === "unknown") {
    this.disconnectApp(instanceId)
    this.emit("handshakeFailed", new Error("WCP4 validation timeout"), connectionAttemptUuid)
  }
}, this.options.handshakeTimeout)
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        apps/sail                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │   main.tsx  │  │ Layout.tsx   │  │  FDC3IframePanel.tsx   │  │
│  │  (creates   │  │  (dockview)  │  │  (renders iframes)     │  │
│  │   agent)    │  │              │  │                        │  │
│  └──────┬──────┘  └──────────────┘  └───────────┬────────────┘  │
│         │                                        │               │
│         ▼                                        │               │
│  ┌─────────────────────────────────┐            │               │
│  │  SailDesktopAgentContext        │            │               │
│  │  - sailAgent                    │            │               │
│  │  - useAppDirectoryStore         │            │               │
│  │  - useConnectionStore  ◄────────┼────────────┘               │
│  └──────┬──────────────────────────┘                            │
└─────────┼───────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     packages/sail-api                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  createSailBrowserDesktopAgent()                        │    │
│  │  Returns: { desktopAgent, wcpConnector, start, stop }   │    │
│  └──────┬──────────────────────────────────────────────────┘    │
└─────────┼───────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  packages/desktop-agent                          │
│                                                                  │
│  ┌──────────────────┐    InMemoryTransport    ┌──────────────┐  │
│  │   DesktopAgent   │◄──────────────────────►│ WCPConnector  │  │
│  │                  │         pair            │               │  │
│  │  - handlers/     │                         │ - connections │  │
│  │  - registries    │                         │ - ports map   │  │
│  └──────────────────┘                         └───────┬───────┘  │
│                                                       │          │
│                                               MessagePort        │
│                                               per app            │
└───────────────────────────────────────────────────────┼──────────┘
                                                        │
                                                        ▼
                                               ┌────────────────┐
                                               │  FDC3 App      │
                                               │  (in iframe)   │
                                               │                │
                                               │  getAgent() →  │
                                               │  WCP1Hello     │
                                               └────────────────┘
```

---

## Message Flow (After Fixes)

```
App sends DACP message
        ↓
MessagePortTransport.onMessage()
        ↓
bridgeTransports: looks up current instanceId via transportToInstanceId map
        ↓
Enriches message with meta.source.instanceId (actual, not temp)
        ↓
InMemoryTransport → DesktopAgent
        ↓
extractInstanceId() reads meta.source.instanceId
        ↓
Handlers receive correct instanceId in context
        ↓
Response routed back via meta.destination.instanceId
        ↓
WCPConnector routes to correct MessagePortTransport
```

---

## Test Checklist for Demo

- [x] App iframe loads and shows 🟢 connection status
- [x] `fdc3.broadcast()` from one app delivers context to another
- [x] `fdc3.joinUserChannel()` succeeds and panel shows channel
- [x] `fdc3.addContextListener()` receives broadcasts
- [x] Multiple apps on same channel receive each other's broadcasts
- [x] App directory has apps loaded at startup
- [ ] App directory browser UI shows available apps (UI not implemented)
- [ ] Channel selector in toolbar (UI not implemented)

---

## Files Changed

| File | Changes |
|------|---------|
| `packages/desktop-agent/src/core/desktop-agent.ts` | Added `extractInstanceId()`, updated `handleMessage()` and `createHandlerContext()` |
| `packages/desktop-agent/src/core/handlers/dacp/context-handlers.ts` | Fixed `notifyContextListeners()` to use `handlerContext.transport` |
| `packages/desktop-agent/src/browser/wcp-connector.ts` | Added `transportToInstanceId` map, WCP5 interception, `channelChanged` event, `panelId` extraction, WCP4 timeout cleanup |
| `apps/sail/src/main.tsx` | Load example apps into directory at startup |
| `apps/sail/package.json` | Added `@finos/fdc3-sail-example-apps` dependency |
| `apps/sail/src/stores/connection-store.ts` | Added `panelId`, `channelId` to Connection, event listeners |
| `apps/sail/src/stores/workspace-store.ts` | Removed hardcoded demo panels, start with empty workspace |
| `apps/sail/src/components/layout-grid/panel-templates/FDC3IframePanel.tsx` | Show channel in panel title |
