# WCP Handshake Flow with Desktop Agent Verification

## Complete Flow

```
[FDC3 App]
   ↓ 1. WCP1Hello (postMessage)
      {
        type: "WCP1Hello",
        payload: {
          identityUrl: "https://app.example.com",
          actualUrl: "https://app.example.com/index.html",
          fdc3Version: "2.2",
          intentResolver: true,
          channelSelector: true
        },
        meta: {
          connectionAttemptUuid: "bc96f1db-9b2b-465f-aab3-3870dc07b072",
          timestamp: "2024-09-09T11:44:39+00:00"
        }
      }

[Transport Proxy]
   ↓ 2. Forward to Desktop Agent for verification
      {
        type: "wcpHandshakeRequest",
        payload: {
          wcp1Hello: { ... },
          sessionInfo: {
            userSessionId: "user-123",
            instanceId: "app-abc",
            appId: "my-fdc3-app"
          },
          origin: "https://app.example.com"
        },
        meta: {
          requestUuid: "550e8400-e29b-41d4-a716-446655440000",
          timestamp: "2024-09-09T11:44:39.123Z"
        }
      }

[Desktop Agent]
   ↓ 3. Verify app identity & approve
      - Check identityUrl against app directory
      - Verify actualUrl matches expected origin
      - Register app instance
      - Approve or deny

   ↓ 4. Send approval response
      {
        type: "wcpHandshakeResponse",
        payload: {
          approved: true,
          instanceId: "app-abc",
          appMetadata: { ... }
        },
        meta: {
          responseUuid: "550e8400-e29b-41d4-a716-446655440000",
          timestamp: "2024-09-09T11:44:39.456Z"
        }
      }

[Transport Proxy]
   ↓ 5. Create MessageChannel
   ↓ 6. Link MessagePort to transport
   ↓ 7. Send WCP3Handshake to app
      {
        type: "WCP3Handshake",
        meta: {
          connectionAttemptUuid: "bc96f1db-9b2b-465f-aab3-3870dc07b072",
          timestamp: "2024-09-09T11:44:39.789Z"
        },
        payload: {
          fdc3Version: "2.2",
          intentResolverUrl: "https://sail.example.com/intent-resolver",
          channelSelectorUrl: "https://sail.example.com/channel-selector"
        }
      } + [MessagePort]

[FDC3 App]
   ↓ 8. Receives MessagePort, ready for DACP
   ↓ 9. Sends DACP messages (getInfoRequest, openRequest, etc.)

[Transport Proxy]
   ↓ 10. Routes DACP messages to Desktop Agent

[Desktop Agent]
   ↓ 11. Processes DACP messages
```

## Desktop Agent Handler Required

The Desktop Agent needs a handler for `wcpHandshakeRequest`:

```typescript
// packages/desktop-agent/src/handlers/dacp/wcp.handlers.ts

import type { DACPHandlerContext } from '../types'

export async function handleWcpHandshakeRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { payload, meta } = message as {
    type: 'wcpHandshakeRequest'
    payload: {
      wcp1Hello: {
        type: 'WCP1Hello'
        payload: {
          identityUrl: string
          actualUrl: string
          fdc3Version: string
          intentResolver: boolean
          channelSelector: boolean
        }
        meta: {
          connectionAttemptUuid: string
          timestamp: string
        }
      }
      sessionInfo: {
        userSessionId: string
        instanceId: string
        appId: string
      }
      origin: string
    }
    meta: {
      requestUuid: string
      timestamp: string
    }
  }

  try {
    // 1. Verify app identity
    const appMetadata = await verifyAppIdentity(
      payload.wcp1Hello.payload.identityUrl,
      payload.origin
    )

    if (!appMetadata) {
      // Reject - app not found in directory
      const response = {
        type: 'wcpHandshakeResponse',
        payload: {
          approved: false,
          reason: 'App not found in app directory'
        },
        meta: {
          responseUuid: meta.requestUuid,
          timestamp: new Date().toISOString()
        }
      }
      context.reply(response)
      return
    }

    // 2. Verify URL matches
    if (!isUrlAllowed(payload.wcp1Hello.payload.actualUrl, appMetadata)) {
      // Reject - URL mismatch
      const response = {
        type: 'wcpHandshakeResponse',
        payload: {
          approved: false,
          reason: 'actualUrl does not match app directory entry'
        },
        meta: {
          responseUuid: meta.requestUuid,
          timestamp: new Date().toISOString()
        }
      }
      context.reply(response)
      return
    }

    // 3. Register app instance
    const appInstance = context.desktopAgent.createAppInstance({
      instanceId: payload.sessionInfo.instanceId,
      appId: payload.sessionInfo.appId,
      appMetadata,
      origin: payload.origin
    })

    console.log(`[WCP] Registered app instance: ${appInstance.instanceId}`)

    // 4. Approve handshake
    const response = {
      type: 'wcpHandshakeResponse',
      payload: {
        approved: true,
        instanceId: appInstance.instanceId,
        appMetadata
      },
      meta: {
        responseUuid: meta.requestUuid,
        timestamp: new Date().toISOString()
      }
    }

    context.reply(response)
    console.log(`[WCP] Handshake approved for: ${payload.sessionInfo.appId}`)

  } catch (error) {
    console.error('[WCP] Handshake verification failed:', error)

    const response = {
      type: 'wcpHandshakeResponse',
      payload: {
        approved: false,
        reason: error instanceof Error ? error.message : 'Internal error'
      },
      meta: {
        responseUuid: meta.requestUuid,
        timestamp: new Date().toISOString()
      }
    }

    context.reply(response)
  }
}
```

## Benefits

✅ **Security** - Desktop Agent verifies app identity before connection
✅ **Access Control** - Desktop Agent can deny based on app directory
✅ **App Registration** - Desktop Agent knows about app before DACP messages
✅ **Standard Flow** - Uses FDC3 WCP standard with Desktop Agent validation
✅ **Error Handling** - Proper WCP4ValidateAppIdentity errors on rejection

## Error Flow

If Desktop Agent denies handshake:

```
[Desktop Agent]
   ↓ wcpHandshakeResponse { approved: false, reason: "..." }

[Transport Proxy]
   ↓ WCP4ValidateAppIdentity error to app
      {
        type: "WCP4ValidateAppIdentity",
        meta: { connectionAttemptUuid: "...", timestamp: "..." },
        payload: {
          validationDetails: [{
            type: "warning",
            description: "Desktop Agent rejected connection"
          }]
        }
      }

[FDC3 App]
   ↓ Connection denied, no MessagePort received
```