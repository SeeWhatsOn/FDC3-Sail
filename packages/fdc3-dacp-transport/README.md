# @finos/fdc3-dacp-transport

Transport abstraction layer for routing FDC3 Desktop Agent Communication Protocol (DACP) messages over different transport mechanisms.

## Overview

This library provides a clean abstraction for connecting FDC3 applications to Desktop Agents regardless of where the Desktop Agent lives (remote server, parent window, etc.). It handles:

- **WCP (Web Connection Protocol)** handshake with FDC3 apps
- **DACP (Desktop Agent Communication Protocol)** message routing
- **Transport abstraction** (Socket.IO, MessagePort, or custom)

## Architecture

```
[FDC3 App using @finos/fdc3]
    ↓ WCP1Hello (postMessage)
[WCP Handler]
    ↓ WCP3Handshake + MessagePort
[FDC3 App receives MessagePort]
    ↓ DACP messages via MessagePort
[Transport Adapter]
    ↓ Socket.IO / MessagePort / Custom
[Desktop Agent]
```

## Installation

```bash
npm install @finos/fdc3-dacp-transport
```

## Usage

### Socket.IO Transport (Remote Desktop Agent)

Use this when your Desktop Agent runs on a remote server:

```typescript
import { createWCPHandler, createSocketIOTransport } from '@finos/fdc3-dacp-transport'
import { io } from 'socket.io-client'

// Connect to server
const socket = io('http://localhost:3000')

// Create Socket.IO transport
const transport = createSocketIOTransport({
  socket,
  sessionInfo: {
    userSessionId: 'user-123',
    instanceId: 'app-instance-abc',
    appId: 'my-fdc3-app'
  },
  debug: true
})

// Create WCP handler
const handler = createWCPHandler({
  transport,
  sessionInfo: {
    userSessionId: 'user-123',
    instanceId: 'app-instance-abc',
    appId: 'my-fdc3-app'
  },
  intentResolverUrl: 'https://example.com/intent-resolver',
  channelSelectorUrl: 'https://example.com/channel-selector',
  debug: true
})

// Listen for WCP handshake from FDC3 apps
window.addEventListener('message', (event) => {
  const iframeWindow = document.querySelector('iframe').contentWindow
  handler.handleWCPMessage(event, iframeWindow)
})

// Cleanup
handler.dispose()
```

### MessagePort Transport (Local Desktop Agent)

Use this when your Desktop Agent runs in the same process (e.g., parent window):

```typescript
import { createWCPHandler, createMessagePortTransport } from '@finos/fdc3-dacp-transport'

// Create MessageChannel to connect to local Desktop Agent
const channel = new MessageChannel()

// port2 connects to local Desktop Agent
const transport = createMessagePortTransport({
  port: channel.port2,
  debug: true
})

// Create WCP handler
const handler = createWCPHandler({
  transport,
  sessionInfo: {
    userSessionId: 'user-123',
    instanceId: 'app-instance-abc',
    appId: 'my-fdc3-app'
  }
})

// Connect channel.port1 to your local Desktop Agent
localDesktopAgent.connectPort(channel.port1)
```

### React Hook Example

```typescript
import { useCallback, useEffect } from 'react'
import { createWCPHandler, createSocketIOTransport } from '@finos/fdc3-dacp-transport'
import { io } from 'socket.io-client'

export function useFDC3Transport(panelId: string, socket: Socket, sessionInfo: SessionInfo) {
  const registerWindow = useCallback((contentWindow: Window) => {
    // Create transport
    const transport = createSocketIOTransport({
      socket,
      sessionInfo,
      debug: true
    })

    // Create handler
    const handler = createWCPHandler({
      transport,
      sessionInfo,
      intentResolverUrl: `${window.location.origin}/intent-resolver`,
      channelSelectorUrl: `${window.location.origin}/channel-selector`
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
  }, [socket, sessionInfo])

  return { registerWindow }
}
```

## Custom Transport

You can create custom transports by implementing the `DACPTransport` interface:

```typescript
import type { DACPTransport, DACPMessage } from '@finos/fdc3-dacp-transport'

function createCustomTransport(config: CustomConfig): DACPTransport {
  return {
    send(message: DACPMessage): void {
      // Send message to Desktop Agent
    },

    onMessage(listener: (message: DACPMessage) => void): void {
      // Register listener for messages from Desktop Agent
    },

    dispose(): void {
      // Cleanup resources
    }
  }
}
```

## API Reference

### `createSocketIOTransport(config)`

Creates a Socket.IO transport adapter.

**Config:**
- `socket` - Socket.IO client socket
- `sessionInfo` - Session information for routing
- `appEventName` - Event name for app→agent messages (default: `'fdc3_app_event'`)
- `daEventName` - Event name for agent→app messages (default: `'fdc3_da_event'`)
- `debug` - Enable debug logging

### `createMessagePortTransport(config)`

Creates a MessagePort transport adapter.

**Config:**
- `port` - MessagePort to communicate over
- `debug` - Enable debug logging

### `createWCPHandler(config)`

Creates a WCP handshake handler.

**Config:**
- `transport` - Transport adapter to use
- `sessionInfo` - Session information
- `intentResolverUrl` - Optional URL for intent resolver UI
- `channelSelectorUrl` - Optional URL for channel selector UI
- `fdc3Version` - FDC3 version (default: `'2.2'`)
- `debug` - Enable debug logging

**Returns:**
- `handleWCPMessage(event, contentWindow)` - Handle WCP1Hello messages
- `dispose()` - Cleanup resources

## License

Apache-2.0