# Intent Resolver UI Implementation Plan

## Overview

Implement a UI for resolving FDC3 intents when multiple handlers are available. Currently, the system auto-selects the first handler without user input.

## Architecture

```
App raises intent (raiseIntentRequest)
        ↓
Desktop Agent finds multiple handlers
        ↓
WCPConnector emits "intentResolverNeeded" event
        ↓
IntentResolverStore updates state (opens dialog)
        ↓
User selects handler in IntentResolverDialog
        ↓
Store sends selection back via wcpConnector
        ↓
Desktop Agent resumes intent flow with selected handler
```

## Implementation Steps

### Step 1: Add WCPConnector Events for Intent Resolution

**File:** `packages/desktop-agent/src/browser/wcp-connector.ts`

Add new events to `WCPConnectorEvents`:
```typescript
export interface WCPConnectorEvents {
  // ... existing events ...
  intentResolverNeeded: (payload: IntentResolverPayload) => void
  intentResolverResponse: (payload: IntentResolverResponse) => void
}

interface IntentResolverPayload {
  requestId: string
  intent: string
  context: unknown
  handlers: Array<{
    instanceId?: string  // For running listeners
    appId: string
    appName?: string
    appIcon?: string
  }>
}

interface IntentResolverResponse {
  requestId: string
  selectedHandler: { instanceId?: string; appId: string } | null  // null = cancelled
}
```

### Step 2: Modify Intent Handler to Emit UI Event

**File:** `packages/desktop-agent/src/core/handlers/dacp/intent-handlers.ts`

In `handleRaiseIntentRequest()`, when multiple handlers exist:

```typescript
if (handlers.compatibleApps.length > 1) {
  // Need UI resolution - emit event and wait for response
  const resolverPayload = {
    requestId: request.meta.requestUuid,
    intent: request.payload.intent,
    context: validatedContext,
    handlers: handlers.compatibleApps.map(h => ({
      instanceId: 'instanceId' in h ? h.instanceId : undefined,
      appId: h.appId,
      appName: /* get from app directory */,
    }))
  }

  // Emit event to UI (needs transport mechanism)
  // Wait for response before continuing
}
```

**Challenge:** The handler context has `transport` which sends to apps, but we need to send to the Sail UI.

**Solution:** Add a new method to WCPConnector that intent handlers can call:
- `wcpConnector.requestIntentResolution(payload): Promise<IntentResolverResponse>`
- This emits the event and returns a Promise that resolves when UI responds

### Step 3: Create Intent Resolver Store

**File:** `apps/sail/src/stores/intent-resolver-store.ts`

```typescript
interface IntentResolverState {
  isOpen: boolean
  requestId: string | null
  intentName: string | null
  context: unknown
  handlers: Array<{
    instanceId?: string
    appId: string
    appName?: string
    appIcon?: string
  }>
}

interface IntentResolverActions {
  openResolver: (payload: IntentResolverPayload) => void
  selectHandler: (handler: { instanceId?: string; appId: string }) => void
  cancel: () => void
}
```

Wire up event listener in store creation (following connection-store.ts pattern):
```typescript
connector.on("intentResolverNeeded", (payload) => {
  store.setState(state => {
    state.isOpen = true
    state.requestId = payload.requestId
    state.intentName = payload.intent
    state.context = payload.context
    state.handlers = payload.handlers
  })
})
```

### Step 4: Create Intent Resolver Dialog Component

**File:** `apps/sail/src/components/intent-resolver/IntentResolverDialog.tsx`

Use Sheet component (already in sail-ui) for modal dialog:

```tsx
export function IntentResolverDialog() {
  const { isOpen, intentName, handlers, selectHandler, cancel } = useIntentResolverStore()

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && cancel()}>
      <SheetContent side="bottom" className="max-h-[50vh]">
        <SheetHeader>
          <SheetTitle>Select Application</SheetTitle>
          <SheetDescription>
            Multiple applications can handle "{intentName}". Select one:
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-2 py-4">
          {handlers.map(handler => (
            <button
              key={handler.instanceId || handler.appId}
              onClick={() => selectHandler(handler)}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent"
            >
              {handler.appIcon && <img src={handler.appIcon} className="size-8" />}
              <div>
                <div className="font-medium">{handler.appName || handler.appId}</div>
                {handler.instanceId && (
                  <div className="text-sm text-muted-foreground">Running instance</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

### Step 5: Add Dialog to App Layout

**File:** `apps/sail/src/App.tsx` or `apps/sail/src/components/Layout.tsx`

Add the IntentResolverDialog component to the app tree:
```tsx
<SailDesktopAgentProvider sailAgent={sailAgent}>
  {/* ... existing components ... */}
  <IntentResolverDialog />
</SailDesktopAgentProvider>
```

### Step 6: Wire Up Response Back to Desktop Agent

When user selects a handler, the store action needs to send the response back:

```typescript
selectHandler: (handler) => {
  const { requestId } = get()

  // Send response back to Desktop Agent
  sailAgent.wcpConnector.emit("intentResolverResponse", {
    requestId,
    selectedHandler: handler
  })

  // Close dialog
  set(state => { state.isOpen = false })
}
```

## Key Challenges & Solutions

### Challenge 1: Communication Path
The Desktop Agent needs to send events TO the UI (not to apps).

**Solution:** The WCPConnector is already available in the UI via `sailAgent.wcpConnector`. We can:
1. Add an EventEmitter pattern for UI-specific events
2. Have the intent handler call `wcpConnector.requestIntentResolution()`
3. The WCPConnector emits the event to UI listeners
4. UI sends response via the same connector

### Challenge 2: Async Handler Flow
The intent handler needs to pause while waiting for UI selection.

**Solution:** Use Promise-based flow:
```typescript
// In intent handler
const selection = await wcpConnector.requestIntentResolution(payload)
if (!selection) {
  throw new Error("Intent resolution cancelled")
}
// Continue with selected handler
```

### Challenge 3: App Directory Metadata
Need app names/icons for the resolver UI.

**Solution:** Query app directory in intent handler to enrich handler data:
```typescript
const appDirectory = context.appDirectory
for (const handler of handlers) {
  const appInfo = appDirectory.get(handler.appId)
  handler.appName = appInfo?.title
  handler.appIcon = appInfo?.icons?.[0]?.src
}
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/desktop-agent/src/browser/wcp-connector.ts` | Modify | Add `requestIntentResolution()` method and event types |
| `packages/desktop-agent/src/core/handlers/dacp/intent-handlers.ts` | Modify | Call `requestIntentResolution()` when multiple handlers |
| `apps/sail/src/stores/intent-resolver-store.ts` | Create | New Zustand store for resolver state |
| `apps/sail/src/components/intent-resolver/IntentResolverDialog.tsx` | Create | New Sheet-based dialog component |
| `apps/sail/src/components/intent-resolver/index.ts` | Create | Export barrel |
| `apps/sail/src/App.tsx` or Layout | Modify | Add IntentResolverDialog to component tree |
| `apps/sail/src/contexts/SailDesktopAgentContext.tsx` | Modify | Add useIntentResolverStore to context |

## Testing Plan

1. Start Sail with multiple FDC3 apps that listen for the same intent
2. Open app A and raise an intent that apps B and C both handle
3. Verify IntentResolverDialog appears with both options
4. Select app B - verify intent is delivered to app B
5. Test cancel flow - verify intent is rejected gracefully
6. Test single handler case - verify no dialog appears (auto-select)

## Estimated Complexity

- **WCPConnector changes:** Medium - need to add async request/response pattern
- **Intent handler changes:** Low - conditional logic to call resolver
- **Store creation:** Low - follows existing patterns
- **UI component:** Low - simple list in Sheet
- **Integration:** Medium - wiring everything together

Total: ~200-300 lines of new code across 5-6 files
