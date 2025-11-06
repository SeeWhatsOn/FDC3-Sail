/**
 * WCP (Web Connection Protocol) Handlers
 *
 * Handles FDC3 Web Connection Protocol messages for app identity validation.
 * Per FDC3 spec, after receiving WCP3Handshake, apps send WCP4ValidateAppIdentity
 * to validate their identity before sending DACP messages.
 */

import type { AppMetadata } from "@finos/fdc3"
import type { DACPHandlerContext } from "../types"
import { startHeartbeat } from "./heartbeat.handlers"

/**
 * WCP4ValidateAppIdentity message from FDC3 app
 */
interface WCP4ValidateAppIdentity {
  type: "WCP4ValidateAppIdentity"
  payload: {
    identityUrl: string
    actualUrl: string
    instanceId?: string
    instanceUuid?: string
  }
  meta: {
    timestamp: string
  }
}

/**
 * WCP5ValidateAppIdentityResponse - success response
 */
interface WCP5ValidateAppIdentityResponse {
  type: "WCP5ValidateAppIdentityResponse"
  payload: {
    appId: string
    instanceId: string
    instanceUuid: string
    implementationMetadata?: {
      fdc3Version: string
      provider: string
      providerVersion?: string
    }
  }
  meta: {
    timestamp: string
  }
}

/**
 * WCP5ValidateAppIdentityFailedResponse - failure response
 */
interface WCP5ValidateAppIdentityFailedResponse {
  type: "WCP5ValidateAppIdentityFailedResponse"
  payload: {
    error: string
  }
  meta: {
    timestamp: string
  }
}

/**
 * Handles WCP4ValidateAppIdentity messages from FDC3 apps.
 *
 * Per FDC3 spec:
 * - This is the first message sent by app after receiving WCP3Handshake
 * - Desktop Agent MUST validate the app identity before accepting DACP messages
 * - Origin of identityUrl, actualUrl, and MessageEvent.origin MUST all match
 *
 * @param message - WCP4ValidateAppIdentity message
 * @param context - Handler context with desktop agent access
 */
export async function handleWCP4ValidateAppIdentity(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const wcp4Message = message as WCP4ValidateAppIdentity
  const { transport, appInstanceRegistry, appDirectory } = context

  console.log("[WCP4] Received app identity validation request:", wcp4Message.payload)

  try {
    const {
      identityUrl,
      actualUrl,
      instanceId: reconnectInstanceId,
      instanceUuid: reconnectInstanceUuid,
    } = wcp4Message.payload

    // 1. Extract origins from URLs
    const identityOrigin = new URL(identityUrl).origin
    const actualOrigin = new URL(actualUrl).origin

    // 2. Validate origins match (per FDC3 spec requirement)
    if (identityOrigin !== actualOrigin) {
      console.error("[WCP4] Origin mismatch:", { identityOrigin, actualOrigin })
      sendFailureResponse(
        context,
        "Origin mismatch: identityUrl and actualUrl must have same origin"
      )
      return
    }

    // TODO: Also validate MessageEvent.origin matches (requires context enhancement)

    // 3. Look up app in app directory
    const apps = appDirectory.allApps

    // Find app by matching identityUrl or actualUrl
    const appMetadata = apps.find((app: any) => {
      // Check if app's URL matches
      if (app.url) {
        try {
          const appOrigin = new URL(app.url).origin
          return appOrigin === identityOrigin
        } catch {
          return false
        }
      }
      return false
    }) as any

    if (!appMetadata) {
      console.error("[WCP4] App not found in directory for identity:", identityUrl)
      sendFailureResponse(context, "App not found in app directory")
      return
    }

    console.log("[WCP4] App found in directory:", appMetadata.appId)

    // 4. Check if reconnecting to existing instance
    let instanceId: string
    let instanceUuid: string

    if (reconnectInstanceId && reconnectInstanceUuid) {
      // Attempt to reconnect to existing instance
      const existingInstance = appInstanceRegistry.getInstance(reconnectInstanceId)

      if (existingInstance) {
        console.log("[WCP4] Reconnecting to existing instance:", reconnectInstanceId)
        instanceId = reconnectInstanceId
        instanceUuid = reconnectInstanceUuid
      } else {
        console.warn("[WCP4] Instance not found for reconnection, creating new instance")
        const newInstance = await createAppInstance(context, appMetadata, identityUrl)
        instanceId = newInstance.instanceId
        instanceUuid = newInstance.instanceId // Use same for now
      }
    } else {
      // Create new app instance
      const newInstance = await createAppInstance(context, appMetadata, identityUrl)
      instanceId = newInstance.instanceId
      instanceUuid = newInstance.instanceId // Use same for now
    }

    // 5. Send success response
    const response: WCP5ValidateAppIdentityResponse = {
      type: "WCP5ValidateAppIdentityResponse",
      payload: {
        appId: appMetadata.appId,
        instanceId,
        instanceUuid,
        implementationMetadata: {
          fdc3Version: "2.2",
          provider: "FDC3-Sail",
          providerVersion: "0.0.1",
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    }

    console.log("[WCP4] Validation successful, sending WCP5 response:", response.payload)

    // Get the instanceId from the response to send the message
    const responseInstanceId = response.payload.instanceId
    transport.send(responseInstanceId, response)

    // Start heartbeat for this instance
    startHeartbeat(responseInstanceId, context)
  } catch (error) {
    console.error("[WCP4] Error during validation:", error)
    sendFailureResponse(
      context,
      error instanceof Error ? error.message : "Internal validation error"
    )
  }
}

/**
 * Helper to create a new app instance
 */
function createAppInstance(
  context: DACPHandlerContext,
  appMetadata: AppMetadata,
  identityUrl: string
) {
  const instanceId = crypto.randomUUID()

  // Register the instance in the app instance registry
  context.appInstanceRegistry.createInstance({
    instanceId,
    appId: appMetadata.appId,
    metadata: {
      appId: appMetadata.appId,
      name: appMetadata.name,
      title: appMetadata.title,
      description: appMetadata.description,
      icons: appMetadata.icons,
      screenshots: appMetadata.screenshots,
    },
  })

  console.log("[WCP4] Created new app instance:", {
    instanceId,
    appId: appMetadata.appId,
    identityUrl,
  })

  return { instanceId }
}

/**
 * Helper to send WCP5 failure response
 */
function sendFailureResponse(context: DACPHandlerContext, error: string): void {
  const response: WCP5ValidateAppIdentityFailedResponse = {
    type: "WCP5ValidateAppIdentityFailedResponse",
    payload: {
      error,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  }

  console.log("[WCP4] Validation failed, sending WCP5 failure response:", error)

  // For failure responses, we need to send to the transport's current instance
  // Since we don't have a validated instanceId yet, we use the transport's getInstanceId()
  const instanceId = context.transport.getInstanceId()
  if (instanceId) {
    context.transport.send(instanceId, response)
  } else {
    console.error("[WCP4] Cannot send failure response: no instanceId available")
  }
}
