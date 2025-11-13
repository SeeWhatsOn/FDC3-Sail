# WCP Integration

This document describes how the Desktop Agent integrates with the Web Connection Protocol (WCP) for browser-based FDC3 deployments.

## Overview

The **Web Connection Protocol (WCP)** is the FDC3 standard for establishing connections between web-based FDC3 apps and Desktop Agents. It enables apps running in iframes or windows to discover and connect to a Desktop Agent using browser-native `postMessage` and `MessageChannel` APIs.

## WCP and Desktop Agent Separation

### Architecture Decision

WCP consists of two distinct responsibilities:

1. **WCP Handshake (WCP1-3)**: Browser-specific connection establishment using `postMessage` and `MessageChannel`
2. **WCP Validation (WCP4-5)**: Pure logic for validating app identity

**Key Principle**: The Desktop Agent package (`@finos/fdc3-sail-desktop-agent`) is environment-agnostic and contains NO browser-specific code. Therefore:

- **WCP Handshake (WCP1-3)**: Lives in `sail-api` package (`ConnectionManager`)
- **WCP Validation (WCP4-5)**: Lives in `desktop-agent` package (DACP handlers)

```
┌─────────────────────────────────────────────────────────────┐
│  sail-api (Browser-Specific)                                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │ ConnectionManager                                   │    │
│  │  - WCP1-3 Handshake (postMessage, MessageChannel) │    │
│  │  - MessagePort Registry                            │    │
│  │  - Message Routing                                  │    │
│  └─────────────────┬──────────────────────────────────┘    │
│                    │ DACP via Transport                     │
└────────────────────┼────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  desktop-agent (Environment-Agnostic)                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Desktop Agent                                       │    │
│  │  - WCP4-5 Validation (pure logic)                  │    │
│  │  - DACP Protocol Handlers                          │    │
│  │  - AppInstanceRegistry                             │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## WCP Message Flow

### Complete WCP Sequence

```
App (iframe)        ConnectionManager       Desktop Agent
     │                     │                      │
     │  WCP1Hello          │                      │
     ├────────────────────►│                      │
     │  (postMessage)      │                      │
     │                     │                      │
     │                     │  Create MessageChannel
     │                     │  Generate instanceId │
     │                     │                      │
     │  WCP3Handshake      │                      │
     │◄────────────────────┤                      │
     │  + port1 (transfer) │                      │
     │                     │                      │
     │                     │  WCP4ValidateAppIdentity (DACP)
     │                     ├─────────────────────►│
     │                     │                      │
     │                     │                      │  Validate identity
     │                     │                      │  Register in AppInstanceRegistry
     │                     │                      │
     │                     │  WCP5ValidateAppIdentityResponse (DACP)
     │                     │◄─────────────────────┤
     │                     │                      │
     │  Continue with      │                      │
     │  regular DACP       │                      │
     │  messages...        │                      │
     │                     │                      │
```

### Message Details

#### WCP1Hello (postMessage)

Sent by app to initiate connection:

```typescript
{
  type: "WCP1Hello",
  meta: {
    connectionAttemptUuid: "uuid-v4",
    timestamp: Date
  },
  payload: {
    fdc3Version: "2.2"
  }
}
```

**Handled by**: `ConnectionManager` (sail-api package)

#### WCP3Handshake (postMessage + MessagePort transfer)

Sent by ConnectionManager to app:

```typescript
{
  type: "WCP3Handshake",
  meta: {
    connectionAttemptUuid: "same-uuid-from-wcp1",
    timestamp: Date
  },
  payload: {
    fdc3Version: "2.2",
    intentResolverUrl?: string,
    channelSelectorUrl?: string
  }
}
// Transfers channel.port1 to app
```

**Handled by**: `ConnectionManager` (sail-api package)

#### WCP4ValidateAppIdentity (DACP)

Sent by ConnectionManager to Desktop Agent via Transport:

```typescript
{
  type: "WCP4ValidateAppIdentity",
  meta: {
    requestUuid: "uuid-v4",
    timestamp: Date,
    source: {
      instanceId: "generated-instance-id"
    }
  },
  payload: {
    identityUrl: string,
    instanceId: string,
    actualUrl: string
  }
}
```

**Handled by**: `wcp4ValidateAppIdentityHandler` (desktop-agent package)

#### WCP5ValidateAppIdentityResponse (DACP)

Sent by Desktop Agent to ConnectionManager via Transport:

```typescript
{
  type: "WCP5ValidateAppIdentityResponse",
  meta: {
    requestUuid: "same-uuid-from-wcp4",
    responseUuid: "uuid-v4",
    timestamp: Date
  },
  payload: {
    instanceId: string,
    appId?: string,
    error?: "Denied" | "ExpiredOrInvalid" | "ErrorOnValidating"
  }
}
```

**Handled by**: `ConnectionManager` (sail-api package)

## Desktop Agent WCP Handlers

### WCP4ValidateAppIdentity Handler

Location: `packages/desktop-agent/src/handlers/dacp/wcp-handlers.ts`

```typescript
import { wcp4ValidateAppIdentityRequestSchema } from "../validation/dacp-schemas"
import type { WCP4ValidateAppIdentityRequest, WCP5ValidateAppIdentityResponse } from "@finos/fdc3-schema"
import type { HandlerContext } from "../types"

export const wcp4ValidateAppIdentityHandler = async (
  message: WCP4ValidateAppIdentityRequest,
  context: HandlerContext
): Promise<WCP5ValidateAppIdentityResponse> => {
  const { appInstanceRegistry, appDirectoryManager } = context

  // Validate message schema
  const parsed = wcp4ValidateAppIdentityRequestSchema.safeParse(message)
  if (!parsed.success) {
    throw new Error(`Invalid WCP4 message: ${parsed.error.message}`)
  }

  const { instanceId, identityUrl, actualUrl } = message.payload

  try {
    // Resolve app identity from identity URL
    const appMetadata = await resolveAppIdentity(identityUrl, appDirectoryManager)

    if (!appMetadata) {
      return {
        type: "WCP5ValidateAppIdentityResponse",
        meta: {
          requestUuid: message.meta.requestUuid,
          responseUuid: crypto.randomUUID(),
          timestamp: new Date(),
        },
        payload: {
          instanceId,
          error: "Denied",
        },
      }
    }

    // Validate actualUrl matches app metadata
    const isValid = validateActualUrl(actualUrl, appMetadata)

    if (!isValid) {
      return {
        type: "WCP5ValidateAppIdentityResponse",
        meta: {
          requestUuid: message.meta.requestUuid,
          responseUuid: crypto.randomUUID(),
          timestamp: new Date(),
        },
        payload: {
          instanceId,
          error: "Denied",
        },
      }
    }

    // Register app instance
    appInstanceRegistry.register({
      instanceId,
      appId: appMetadata.appId,
      metadata: appMetadata,
    })

    return {
      type: "WCP5ValidateAppIdentityResponse",
      meta: {
        requestUuid: message.meta.requestUuid,
        responseUuid: crypto.randomUUID(),
        timestamp: new Date(),
      },
      payload: {
        instanceId,
        appId: appMetadata.appId,
      },
    }
  } catch (error) {
    return {
      type: "WCP5ValidateAppIdentityResponse",
      meta: {
        requestUuid: message.meta.requestUuid,
        responseUuid: crypto.randomUUID(),
        timestamp: new Date(),
      },
      payload: {
        instanceId,
        error: "ErrorOnValidating",
      },
    }
  }
}
```

### Handler Registration

Register in `packages/desktop-agent/src/handlers/dacp/index.ts`:

```typescript
import { wcp4ValidateAppIdentityHandler } from "./wcp-handlers"

export const dacpHandlers: DACPHandlerMap = {
  // ... other handlers
  WCP4ValidateAppIdentity: wcp4ValidateAppIdentityHandler,
}
```

## Using WCP with Desktop Agent

### Option 1: Factory Function (Recommended)

Use the provided factory function from `sail-api`:

```typescript
import { createBrowserDesktopAgent } from "@finos/fdc3-sail-api"

// Creates Desktop Agent + ConnectionManager
const { desktopAgent, connectionManager } = createBrowserDesktopAgent({
  mode: "browser", // Desktop Agent in same window
})

// OR for server mode
const { desktopAgent, connectionManager } = createBrowserDesktopAgent({
  mode: "server",
  serverUrl: "http://localhost:8080",
})
```

### Option 2: Manual Setup

```typescript
import { DesktopAgent } from "@finos/fdc3-sail-desktop-agent"
import { ConnectionManager, MessagePortTransport } from "@finos/fdc3-sail-api"

// Create transport
const transport = new MessagePortTransport(workerPort)

// Create Desktop Agent
const desktopAgent = new DesktopAgent(transport)

// Create ConnectionManager (handles WCP)
const connectionManager = new ConnectionManager(transport, {
  getIntentResolverUrl: (instanceId) => `/intent-resolver.html?instanceId=${instanceId}`,
  getChannelSelectorUrl: (instanceId) => `/channel-selector.html?instanceId=${instanceId}`,
})

// ConnectionManager automatically:
// - Listens for WCP1Hello
// - Handles WCP handshake
// - Sends WCP4 to Desktop Agent
// - Routes messages
```

## Identity Resolution

### App Metadata Resolution

The WCP4 handler must resolve app identity from the `identityUrl`:

```typescript
async function resolveAppIdentity(
  identityUrl: string,
  appDirectoryManager: AppDirectoryManager
): Promise<AppMetadata | null> {
  // 1. Parse identityUrl
  const url = new URL(identityUrl)

  // 2. Extract appId (implementation-specific)
  // Could be in path, query param, or require HTTP fetch
  const appId = extractAppId(url)

  // 3. Query app directory
  const appMetadata = await appDirectoryManager.getApp(appId)

  return appMetadata
}
```

### URL Validation

Validate that `actualUrl` matches app metadata:

```typescript
function validateActualUrl(actualUrl: string, appMetadata: AppMetadata): boolean {
  const actual = new URL(actualUrl)

  // Check against app details
  for (const detail of appMetadata.details.web || []) {
    const expected = new URL(detail.url)

    // Match origin at minimum
    if (actual.origin === expected.origin) {
      return true
    }
  }

  return false
}
```

## Error Handling

### WCP4 Validation Errors

WCP5 response includes error field:

```typescript
type WCP5Error = "Denied" | "ExpiredOrInvalid" | "ErrorOnValidating"
```

**Denied**: App identity could not be validated or is not permitted

**ExpiredOrInvalid**: Identity credentials are expired or invalid

**ErrorOnValidating**: Server error during validation

### Handling in ConnectionManager

```typescript
// In ConnectionManager after receiving WCP5
if (response.payload.error) {
  console.error(`WCP validation failed: ${response.payload.error}`)

  // Close MessagePort
  const port = this.portMap.get(response.payload.instanceId)
  if (port) {
    port.close()
    this.portMap.delete(response.payload.instanceId)
  }

  return
}

// Success - app is validated
this.emit("appConnected", response.payload.instanceId)
```

## DACP Compliance

### Implemented

- ✅ WCP4ValidateAppIdentity handler
- ✅ WCP5ValidateAppIdentityResponse generation
- ✅ App instance registration after validation
- ✅ Schema validation using auto-generated Zod schemas

### Not Implemented

- ❌ WCP4 timeout handling (30 second timeout)
- ❌ Identity URL fetching (currently assumes appId extraction)
- ❌ Certificate validation for HTTPS identity URLs
- ❌ App permission policies

See [DACP Compliance](./src/handlers/dacp/DACP-COMPLIANCE.md) for full status.

## Testing

### Unit Tests for WCP4 Handler

```typescript
import { wcp4ValidateAppIdentityHandler } from "./wcp-handlers"
import { MockAppDirectoryManager } from "../__tests__/mocks"

describe("wcp4ValidateAppIdentityHandler", () => {
  it("should validate and register app instance", async () => {
    const appDirectoryManager = new MockAppDirectoryManager()
    appDirectoryManager.addApp({
      appId: "test-app",
      details: {
        web: [{ url: "https://example.com/app" }],
      },
    })

    const appInstanceRegistry = new AppInstanceRegistry()

    const message: WCP4ValidateAppIdentityRequest = {
      type: "WCP4ValidateAppIdentity",
      meta: {
        requestUuid: "test-uuid",
        timestamp: new Date(),
        source: { instanceId: "test-instance" },
      },
      payload: {
        instanceId: "test-instance",
        identityUrl: "https://example.com/app",
        actualUrl: "https://example.com/app",
      },
    }

    const response = await wcp4ValidateAppIdentityHandler(message, {
      appInstanceRegistry,
      appDirectoryManager,
    })

    expect(response.type).toBe("WCP5ValidateAppIdentityResponse")
    expect(response.payload.error).toBeUndefined()
    expect(response.payload.appId).toBe("test-app")

    // Verify registration
    const instance = appInstanceRegistry.getInstance("test-instance")
    expect(instance).toBeDefined()
    expect(instance.appId).toBe("test-app")
  })

  it("should return Denied for invalid app", async () => {
    const appDirectoryManager = new MockAppDirectoryManager()
    const appInstanceRegistry = new AppInstanceRegistry()

    const message: WCP4ValidateAppIdentityRequest = {
      type: "WCP4ValidateAppIdentity",
      meta: {
        requestUuid: "test-uuid",
        timestamp: new Date(),
        source: { instanceId: "test-instance" },
      },
      payload: {
        instanceId: "test-instance",
        identityUrl: "https://unknown.com/app",
        actualUrl: "https://unknown.com/app",
      },
    }

    const response = await wcp4ValidateAppIdentityHandler(message, {
      appInstanceRegistry,
      appDirectoryManager,
    })

    expect(response.payload.error).toBe("Denied")
    expect(response.payload.appId).toBeUndefined()
  })
})
```

### Integration Tests

```typescript
import { createBrowserDesktopAgent } from "@finos/fdc3-sail-api"

describe("WCP Integration", () => {
  it("should complete full WCP handshake", async () => {
    const { desktopAgent, connectionManager } = createBrowserDesktopAgent({
      mode: "browser",
    })

    // Simulate app sending WCP1Hello
    const wcp1: BrowserTypes.WebConnectionProtocol1Hello = {
      type: "WCP1Hello",
      meta: {
        connectionAttemptUuid: "test-uuid",
        timestamp: new Date(),
      },
      payload: {
        fdc3Version: "2.2",
      },
    }

    window.postMessage(wcp1, "*")

    // Wait for WCP3Handshake
    const wcp3 = await waitForMessage("WCP3Handshake")

    expect(wcp3.meta.connectionAttemptUuid).toBe("test-uuid")
    expect(wcp3.payload.fdc3Version).toBe("2.2")
  })
})
```

## Exported from Desktop Agent

The desktop-agent package exports ONLY the WCP validation handler:

```typescript
// packages/desktop-agent/src/index.ts
export { DesktopAgent } from "./desktop-agent"
export { wcp4ValidateAppIdentityHandler } from "./handlers/dacp/wcp-handlers"
export type { Transport } from "./interfaces/transport"

// NO browser-specific WCP exports
```

## Related Documentation

- [ConnectionManager](../sail-api/CONNECTION_MANAGER.md) - Browser-side WCP handling
- [Transport Interface](../sail-api/TRANSPORT.md) - Transport abstraction
- [DACP Compliance](./src/handlers/dacp/DACP-COMPLIANCE.md) - Implementation status
- [FDC3 WCP Specification](https://fdc3.finos.org/docs/api/specs/webConnectionProtocol)

## Key Takeaways

1. **WCP is split**: Browser code (WCP1-3) in `sail-api`, validation logic (WCP4-5) in `desktop-agent`
2. **Environment-agnostic**: Desktop Agent has no browser dependencies
3. **ConnectionManager required**: Browser deployments MUST use ConnectionManager for WCP
4. **Factory functions**: Use `createBrowserDesktopAgent()` for convenience
5. **Pure DACP**: Desktop Agent only understands DACP messages (including WCP4-5)
6. **Validation required**: Apps must pass WCP4 validation before connecting

## Future Enhancements

- Support for identity URL fetching (not just appId extraction)
- Certificate validation for HTTPS identity URLs
- App permission policies and user consent flows
- WCP timeout enforcement (30 seconds)
- Multiple identity resolution strategies (directory, manifest, JWT)
