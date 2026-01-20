/**
 * WCP (Web Connection Protocol) Handlers
 *
 * Handles FDC3 Web Connection Protocol messages for app identity validation.
 * Per FDC3 spec, after receiving WCP3Handshake, apps send Wcp4Validateappidentity
 * to validate their identity before sending DACP messages.
 */

import type { AppMetadata } from "@finos/fdc3"
import type { DACPHandlerContext } from "../types"
import { startHeartbeat } from "./heartbeat-handlers"
import { cleanupDACPHandlers } from "./index"
import { getInstance } from "../../state/selectors"
import { connectInstance } from "../../state/transforms"

/**
 * WCP4ValidateAppIdentity message from FDC3 app
 * Supports both "Wcp4Validateappidentity" and "WCP4ValidateAppIdentity" type variants
 */
interface Wcp4ValidateAppIdentity {
  type: "WCP4ValidateAppIdentity"
  payload: {
    identityUrl: string
    actualUrl: string
    instanceId?: string
    instanceUuid?: string
  }
  meta: {
    timestamp: string
    connectionAttemptUuid?: string
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
    connectionAttemptUuid?: string
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
    requestUuid: string
    responseUuid: string
  }
}

/**
 * Handles Wcp4Validateappidentity messages from FDC3 apps.
 *
 * Per FDC3 spec:
 * - This is the first message sent by app after receiving WCP3Handshake
 * - Desktop Agent MUST validate the app identity before accepting DACP messages
 * - Origin of identityUrl, actualUrl, and MessageEvent.origin MUST all match
 *
 * @param message - Wcp4Validateappidentity message
 * @param context - Handler context with desktop agent access
 */
export function handleWcp4ValidateAppIdentity(message: unknown, context: DACPHandlerContext): void {
  const wcp4Message = message as Wcp4ValidateAppIdentity
  const { transport, getState, setState, appDirectory, logger } = context

  logger.info("[WCP4] Received app identity validation request", wcp4Message.payload)

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
      logger.error("[WCP4] Origin mismatch", { identityOrigin, actualOrigin })
      sendFailureResponse(
        context,
        "Origin mismatch: identityUrl and actualUrl must have same origin"
      )
      return
    }

    // TODO: Also validate MessageEvent.origin matches (requires context enhancement)

    // 3. Look up app in app directory
    const apps = appDirectory.allApps

    // Helper to normalize URLs for comparison (remove trailing slashes, etc.)
    const normalizeUrl = (url: string): string => {
      try {
        const urlObj = new URL(url)
        // Remove trailing slash from pathname
        let pathname = urlObj.pathname
        if (pathname.endsWith("/") && pathname.length > 1) {
          pathname = pathname.slice(0, -1)
        }
        return `${urlObj.origin}${pathname}${urlObj.search}${urlObj.hash}`
      } catch {
        return url
      }
    }

    // Find app by matching identityUrl or actualUrl (compare full URL path, not just origin)
    const normalizedIdentityUrl = normalizeUrl(identityUrl)
    const normalizedActualUrl = normalizeUrl(actualUrl)

    const appMetadata = apps.find(app => {
      // Check if app's URL matches
      if (
        app.details &&
        typeof app.details === "object" &&
        "url" in app.details &&
        typeof app.details.url === "string"
      ) {
        try {
          const normalizedAppUrl = normalizeUrl(app.details.url)
          // Match if the normalized app URL matches either the identity URL or actual URL
          return (
            normalizedAppUrl === normalizedIdentityUrl || normalizedAppUrl === normalizedActualUrl
          )
        } catch {
          return false
        }
      }
      return false
    })

    if (!appMetadata) {
      logger.error("[WCP4] App not found in directory for identity", identityUrl)
      sendFailureResponse(context, "App not found in app directory")
      return
    }

    logger.info("[WCP4] App found in directory", appMetadata.appId)

    // 4. Check if reconnecting to existing instance
    let instanceId: string
    let instanceUuid: string

    if (reconnectInstanceId && reconnectInstanceUuid) {
      // Attempt to reconnect to existing instance
      const existingInstance = getInstance(getState(), reconnectInstanceId)

      if (existingInstance) {
        logger.info("[WCP4] Reconnecting to existing instance", reconnectInstanceId)
        instanceId = reconnectInstanceId
        instanceUuid = reconnectInstanceUuid
      } else {
        logger.warn("[WCP4] Instance not found for reconnection, creating new instance")
        const newInstance = createAppInstance(context, appMetadata, identityUrl)
        instanceId = newInstance.instanceId
        instanceUuid = newInstance.instanceId // Use same for now
      }
    } else {
      // Create new app instance
      const newInstance = createAppInstance(context, appMetadata, identityUrl)
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

    logger.info("[WCP4] Validation successful, sending WCP5 response", response.payload)

    // Extract connectionAttemptUuid from WCP4 message or from temporary instanceId
    // The temporary instanceId format is "temp-{connectionAttemptUuid}"
    let connectionAttemptUuid: string | undefined = wcp4Message.meta.connectionAttemptUuid
    if (!connectionAttemptUuid && context.instanceId.startsWith("temp-")) {
      connectionAttemptUuid = context.instanceId.replace("temp-", "")
    }

    // Use the source instanceId (temporary) as destination so WCP connector can migrate it
    // The WCP connector will intercept this response and migrate from temp to actual instanceId
    const sourceInstanceId = context.instanceId

    // Add routing metadata - use source instanceId so WCP connector can find the connection
    // Include connectionAttemptUuid so FDC3 get-agent library can match the response
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        connectionAttemptUuid,
        destination: { instanceId: sourceInstanceId },
      },
    }

    transport.send(responseWithRouting)

    // Start heartbeat for the actual instance (not the temp one)
    startHeartbeat(instanceId, context)
  } catch (error) {
    logger.error("[WCP4] Error during validation", error)
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

  // Register the instance using state transform
  context.setState(state =>
    connectInstance(state, {
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
  )

  context.logger.info("[WCP4] Created new app instance", {
    instanceId,
    appId: appMetadata.appId,
    identityUrl,
  })

  return { instanceId }
}

/**
 * Handles WCP6Goodbye messages from FDC3 apps.
 *
 * Per FDC3 spec:
 * - Apps send WCP6Goodbye when they are closing/unloading
 * - Desktop Agent should clean up all resources for that instance
 *
 * This handler is called when WCPConnector forwards the goodbye message
 * through the transport, allowing cleanup to happen regardless of where
 * the Desktop Agent is running (same process, worker, or server).
 *
 * @param message - WCP6Goodbye message
 * @param context - Handler context with desktop agent access
 */
export function handleWCP6Goodbye(_message: unknown, context: DACPHandlerContext): void {
  const { instanceId, logger } = context

  logger.info("[WCP6] Received goodbye from app instance", instanceId)

  // Import cleanup function dynamically to avoid circular dependency
  // The cleanup function handles:
  // - Cancelling pending intents
  // - Removing event listeners
  // - Removing private channels
  // - Stopping heartbeat
  // - Removing from state
  cleanupDACPHandlers(context)

  logger.info("[WCP6] Cleanup completed for instance", instanceId)
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
      // We need requestUuid/responseUuid but don't have them easily here without the request message
      // For now, generating new ones or using empty strings if allowed by schema
      requestUuid: "",
      responseUuid: crypto.randomUUID(),
    },
  }

  context.logger.info("[WCP4] Validation failed, sending WCP5 failure response", error)

  // Try to get the instance ID from the transport (e.g. socket ID)
  const instanceId = context.transport.getInstanceId()

  if (instanceId) {
    // Add routing metadata
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        destination: { instanceId },
      },
    }
    context.transport.send(responseWithRouting)
  } else {
    context.logger.error("[WCP4] Cannot send failure response: instanceId not established")
  }
}
