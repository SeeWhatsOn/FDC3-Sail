# Simplified Usage - Pure WCP Proxy

The library is now a **pure WCP proxy** with no custom handshake logic. All initialization happens via standard FDC3 DACP messages.

## Before (180 lines with APP_HELLO)

```typescript
export const useFDC3Connection = (panelId: string) => {
  const { getSocket, getSessionInfo } = useDesktopAgent()

  // Complex handleSocketConnection with APP_HELLO handshake...
  // Complex link function...
  // Complex handleWCPMessage...
  // Complex registerWindow...

  return { registerWindow }
}
```

## After (30 lines, pure WCP)

```typescript
import { createWCPHandler, createSocketIOTransport } from '@finos/fdc3-dacp-transport'

export const useFDC3Connection = (panelId: string) => {
  const { getSocket, getSessionInfo } = useDesktopAgent()

  const registerWindow = useCallback((contentWindow: Window) => {
    const socket = getSocket()
    const sessionInfo = getSessionInfo()

    // Create Socket.IO transport
    const transport = createSocketIOTransport({
      socket,
      sessionInfo,
      appEventName: 'FDC3_APP_EVENT',
      daEventName: 'FDC3_DA_EVENT',
      debug: true
    })

    // Create WCP handler
    const suffix = `?desktopAgentId=${sessionInfo.userSessionId}&instanceId=${sessionInfo.instanceId}`
    const handler = createWCPHandler({
      transport,
      sessionInfo,
      intentResolverUrl: window.location.origin + `/html/ui/intent-resolver.html${suffix}`,
      channelSelectorUrl: window.location.origin + `/html/ui/channel-selector.html${suffix}`,
      fdc3Version: '2.2',
      debug: true
    })

    // Listen for WCP messages
    const messageListener = (event: MessageEvent) => {
      handler.handleWCPMessage(event, contentWindow)
    }

    window.addEventListener('message', messageListener)

    // Cleanup
    return () => {
      window.removeEventListener('message', messageListener)
      handler.dispose()
    }
  }, [panelId, getSocket, getSessionInfo])

  return { registerWindow }
}
```

## What Happens Now

1. **FDC3 App** sends `WCP1Hello` via `postMessage`
2. **Library** responds with `WCP3Handshake` + MessagePort (pure FDC3 standard)
3. **FDC3 App** sends DACP messages via MessagePort (e.g., `getInfoRequest`, `openRequest`)
4. **Library** forwards DACP over Socket.IO (`fdc3_event`)
5. **Desktop Agent** receives DACP, processes, and responds

## Desktop Agent Changes Needed

The Desktop Agent should handle app initialization via standard DACP messages. For example, when it receives the first DACP message from an app, it can:

1. Register the app instance
2. Set up context listeners
3. Return appropriate responses

No separate `APP_HELLO` needed - it's all FDC3 standard!