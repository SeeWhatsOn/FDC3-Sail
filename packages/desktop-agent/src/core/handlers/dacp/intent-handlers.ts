import {
  validateDACPMessage,
  createDACPErrorResponse,
  createDACPSuccessResponse,
  createIntentEvent,
  DACP_ERROR_TYPES,
  generateEventUuid,
} from "../validation/dacp-validator"
import {
  RaiseIntentRequestSchema,
  RaiseIntentForContextRequestSchema,
  AddIntentListenerRequestSchema,
  IntentListenerUnsubscribeRequestSchema,
  FindIntentRequestSchema,
  FindIntentsByContextRequestSchema,
  IntentResultRequestSchema,
  ContextSchema,
} from "../validation/dacp-schemas"
import { type DACPHandlerContext, type IntentHandlerOption, logger } from "../types"
import { type Context } from "@finos/fdc3"
import { AppInstanceState } from "../../state/app-instance-registry"

/**
 * Helper function to launch an app and wait for it to be registered
 */
async function launchAppAndWaitForInstance(
  appId: string,
  context: DACPHandlerContext,
  validatedContext: unknown
): Promise<string> {
  const { appLauncher, appDirectory, appInstanceRegistry } = context

  if (!appLauncher) {
    throw new Error("App launching not available - no AppLauncher configured")
  }

  // Get app metadata from directory
  const apps = appDirectory.retrieveAppsById(appId)
  if (apps.length === 0) {
    throw new Error(`App not found in directory: ${appId}`)
  }
  const appMetadata = apps[0]

  logger.info("DACP: Launching app for intent", {
    appId,
    hasContext: !!validatedContext,
  })

  // Launch the app
  const launchResult = await appLauncher.launch(
    {
      app: { appId },
      context: validatedContext as Context | undefined,
    },
    appMetadata
  )

  const targetInstanceId = launchResult.appIdentifier.instanceId
  if (!targetInstanceId) {
    throw new Error("App launcher did not return an instance ID")
  }

  logger.info("DACP: App launched, waiting for instance registration", {
    appId,
    instanceId: targetInstanceId,
  })

  // Wait for the instance to be registered (with timeout)
  const maxWaitTime = 10000 // 10 seconds
  const checkInterval = 100 // Check every 100ms
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    const instance = appInstanceRegistry.getInstance(targetInstanceId)
    if (instance && instance.state === AppInstanceState.CONNECTED) {
      logger.info("DACP: App instance registered and ready", {
        appId,
        instanceId: targetInstanceId,
        state: instance.state,
      })
      return targetInstanceId
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval))
  }

  throw new Error(`App instance ${targetInstanceId} did not register within ${maxWaitTime}ms`)
}

export async function handleRaiseIntentRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, appInstanceRegistry, intentRegistry, appDirectory } = context

  try {
    const request = validateDACPMessage(message, RaiseIntentRequestSchema)

    logger.info("DACP: Processing raise intent request", {
      intent: request.payload.intent,
      requestUuid: request.meta.requestUuid,
    })

    const validatedContext = validateDACPMessage(request.payload.context, ContextSchema)
    const source = appInstanceRegistry.getInstance(instanceId)

    if (!source) {
      throw new Error(`Source instance ${instanceId} not found`)
    }

    // Find intent handlers for this request
    const handlers = intentRegistry.findIntentHandlers({
      intent: request.payload.intent,
      context: validatedContext,
      source: { appId: source.appId, instanceId: source.instanceId },
      target:
        typeof request.payload.app === "string"
          ? { appId: request.payload.app }
          : request.payload.app,
      requestId: request.meta.requestUuid,
    })

    // Check if we have any compatible handlers
    if (handlers.compatibleApps.length === 0) {
      throw new Error(`No apps found to handle intent: ${request.payload.intent}`)
    }

    let targetInstanceId: string
    let targetAppId: string

    // Check if we need UI resolution (multiple handlers available)
    const needsResolution = handlers.compatibleApps.length > 1 && context.requestIntentResolution

    if (needsResolution) {
      // Build handler options for UI with app metadata
      const handlerOptions: IntentHandlerOption[] = handlers.compatibleApps.map(handler => {
        const isRunning = "instanceId" in handler
        const apps = appDirectory.retrieveAppsById(handler.appId)
        const appInfo = apps[0] // Take first matching app
        return {
          instanceId: isRunning ? handler.instanceId : undefined,
          appId: handler.appId,
          appName: appInfo?.title || handler.appId,
          appIcon: appInfo?.icons?.[0]?.src,
          isRunning,
        }
      })

      logger.info("DACP: Multiple handlers found, requesting UI resolution", {
        intent: request.payload.intent,
        handlerCount: handlerOptions.length,
      })

      // Request UI resolution
      const resolution = await context.requestIntentResolution!({
        requestId: request.meta.requestUuid,
        intent: request.payload.intent,
        context: validatedContext,
        handlers: handlerOptions,
      })

      if (!resolution.selectedHandler) {
        throw new Error("Intent resolution cancelled by user")
      }

      targetAppId = resolution.selectedHandler.appId
      if (resolution.selectedHandler.instanceId) {
        // Selected a running instance
        targetInstanceId = resolution.selectedHandler.instanceId
      } else {
        // Need to launch the app
        targetInstanceId = await launchAppAndWaitForInstance(targetAppId, context, validatedContext)
      }
    } else if (handlers.runningListeners.length > 0) {
      // Single handler or no UI - use a running listener (preferred)
      const listener = handlers.runningListeners[0]
      targetInstanceId = listener.instanceId
      targetAppId = listener.appId
    } else if (handlers.availableApps.length > 0) {
      // Need to launch an app
      const appCapability = handlers.availableApps[0]
      targetAppId = appCapability.appId
      targetInstanceId = await launchAppAndWaitForInstance(targetAppId, context, validatedContext)
    } else {
      throw new Error(`No handler found for intent: ${request.payload.intent}`)
    }

    // Register pending intent and get promise for result
    const resultPromise = intentRegistry.registerPendingIntent({
      requestId: request.meta.requestUuid,
      intentName: request.payload.intent,
      context: validatedContext,
      sourceInstanceId: instanceId,
      targetInstanceId,
      targetAppId,
      timeoutMs: 30000,
    })

    // Send intentEvent to target app
    const intentEvent = createIntentEvent(
      request.payload.intent,
      validatedContext,
      request.meta.requestUuid,
      {
        appId: source.appId,
        instanceId: source.instanceId,
      }
    )

    logger.info("DACP: Sending intentEvent to target app", {
      targetInstanceId,
      intent: request.payload.intent,
      requestUuid: request.meta.requestUuid,
    })

    // Add routing metadata
    const intentEventWithRouting = {
      ...intentEvent,
      meta: {
        ...intentEvent.meta,
        destination: { instanceId: targetInstanceId },
      },
    }

    transport.send(intentEventWithRouting)

    // Wait for the result from intentResultRequest handler
    await resultPromise

    // Get target app instance information
    const targetInstance = appInstanceRegistry.getInstance(targetInstanceId)
    if (!targetInstance) {
      throw new Error(`Target instance ${targetInstanceId} not found`)
    }

    // Send response back to source app with intentResolution
    const response = createDACPSuccessResponse(request, "raiseIntentResponse", {
      intentResolution: {
        source: {
          appId: targetInstance.appId,
          instanceId: targetInstance.instanceId,
        },
        intent: request.payload.intent,
      },
    })

    // Add routing metadata
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        destination: { instanceId },
      },
    }

    transport.send(responseWithRouting)
  } catch (error) {
    logger.error("DACP: Raise intent request failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.INTENT_DELIVERY_FAILED,
      "raiseIntentResponse",
      error instanceof Error ? error.message : "Intent delivery failed"
    )
    // Add routing metadata
    const errorResponseWithRouting = {
      ...errorResponse,
      meta: {
        ...errorResponse.meta,
        destination: { instanceId },
      },
    }

    transport.send(errorResponseWithRouting)
  }
}

export function handleAddIntentListener(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId, appInstanceRegistry, intentRegistry } = context

  try {
    const request = validateDACPMessage(message, AddIntentListenerRequestSchema)
    const instance = appInstanceRegistry.getInstance(instanceId)

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found for adding intent listener`)
    }

    const listenerId = generateEventUuid()

    intentRegistry.registerListener({
      listenerId,
      intentName: request.payload.intent,
      instanceId,
      appId: instance.appId,
    })

    // FDC3 spec requires listenerUUID (not listenerId) in the response payload
    //TODO: change the var to match the spec - listenerId -> listenerUUID
    const response = createDACPSuccessResponse(request, "addIntentListenerResponse", {
      listenerUUID: listenerId,
    })

    // Add routing metadata
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        destination: { instanceId },
      },
    }

    transport.send(responseWithRouting)
  } catch (error) {
    logger.error("DACP: Add intent listener failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.LISTENER_ERROR,
      "addIntentListenerResponse",
      error instanceof Error ? error.message : "Failed to add intent listener"
    )
    // Add routing metadata
    const errorResponseWithRouting = {
      ...errorResponse,
      meta: {
        ...errorResponse.meta,
        destination: { instanceId },
      },
    }

    transport.send(errorResponseWithRouting)
  }
}

export function handleIntentListenerUnsubscribe(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, intentRegistry } = context

  try {
    const request = validateDACPMessage(message, IntentListenerUnsubscribeRequestSchema)
    const listenerUUID = request.payload.listenerUUID

    const unregistered = intentRegistry.unregisterListener(listenerUUID)
    if (!unregistered) {
      throw new Error(`Intent listener ${listenerUUID} not found`)
    }

    const response = createDACPSuccessResponse(request, "intentListenerUnsubscribeResponse")
    // Add routing metadata
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        destination: { instanceId },
      },
    }

    transport.send(responseWithRouting)
  } catch (error) {
    logger.error("DACP: Intent listener unsubscribe failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.LISTENER_ERROR,
      "intentListenerUnsubscribeResponse",
      error instanceof Error ? error.message : "Failed to unsubscribe intent listener"
    )
    // Add routing metadata
    const errorResponseWithRouting = {
      ...errorResponse,
      meta: {
        ...errorResponse.meta,
        destination: { instanceId },
      },
    }

    transport.send(errorResponseWithRouting)
  }
}

export function handleFindIntentRequest(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId, intentRegistry } = context

  try {
    const request = validateDACPMessage(message, FindIntentRequestSchema)
    const intent = (request.payload as { intent: string }).intent
    const contextType = (request.payload as { context: Context })?.context?.type

    const appIntents = intentRegistry.createAppIntents(intent, contextType)

    const response = createDACPSuccessResponse(request, "findIntentResponse", {
      appIntent: appIntents[0] ?? { intent: { name: intent, displayName: intent }, apps: [] },
    })

    // Add routing metadata
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        destination: { instanceId },
      },
    }

    transport.send(responseWithRouting)
  } catch (error) {
    logger.error("DACP: Find intent request failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.NO_APPS_FOUND,
      "findIntentResponse",
      error instanceof Error ? error.message : "Failed to find apps for intent"
    )
    // Add routing metadata
    const errorResponseWithRouting = {
      ...errorResponse,
      meta: {
        ...errorResponse.meta,
        destination: { instanceId },
      },
    }

    transport.send(errorResponseWithRouting)
  }
}

export function handleIntentResultRequest(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId, intentRegistry } = context

  try {
    const request = validateDACPMessage(message, IntentResultRequestSchema)

    logger.info("DACP: Processing intent result request", {
      requestUuid: request.meta.requestUuid,
      raiseIntentRequestUuid: request.payload.raiseIntentRequestUuid,
    })

    // Get the original request ID from payload.raiseIntentRequestUuid
    const originalRequestId = request.payload.raiseIntentRequestUuid

    // Check if there's a pending intent for this request
    const pendingIntent = intentRegistry.getPendingIntent(originalRequestId)

    if (!pendingIntent) {
      throw new Error(`No pending intent found for request: ${originalRequestId}`)
    }

    // Verify that the instanceId matches the target instance
    if (pendingIntent.targetInstanceId !== instanceId) {
      throw new Error(
        `Intent result from wrong instance. Expected ${pendingIntent.targetInstanceId}, got ${instanceId}`
      )
    }

    // Note: Errors are communicated via error responses, not via request.payload.error
    // If the intent handler failed, it would send an error response directly,
    // not an intentResultRequest with an error field

    // Resolve the pending intent with the result
    const intentResult = request.payload.intentResult
    intentRegistry.resolvePendingIntent(originalRequestId, intentResult)

    // Send acknowledgment response
    const response = createDACPSuccessResponse(request, "intentResultResponse")
    // Add routing metadata
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        destination: { instanceId },
      },
    }

    transport.send(responseWithRouting)

    logger.info("DACP: Intent result processed successfully", {
      originalRequestId,
      hasResult: !!intentResult,
    })
  } catch (error) {
    logger.error("DACP: Intent result request failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.INTENT_DELIVERY_FAILED,
      "intentResultResponse",
      error instanceof Error ? error.message : "Failed to process intent result"
    )
    // Add routing metadata
    const errorResponseWithRouting = {
      ...errorResponse,
      meta: {
        ...errorResponse.meta,
        destination: { instanceId },
      },
    }

    transport.send(errorResponseWithRouting)
  }
}

export function handleFindIntentsByContextRequest(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, intentRegistry } = context

  try {
    const request = validateDACPMessage(message, FindIntentsByContextRequestSchema)
    const contextType = (request.payload as { context: Context }).context?.type

    if (!contextType) {
      throw new Error("Context type is required for findIntentsByContext")
    }

    logger.info("DACP: Finding intents for context type", { contextType })

    // Use IntentRegistry to find all intents that can handle this context type
    const intentMetadata = intentRegistry.findIntentsByContext(contextType)

    // Convert to AppIntent[] format
    const appIntents = intentMetadata.map(metadata => {
      const appIntentsForIntent = intentRegistry.createAppIntents(metadata.name, contextType)
      return (
        appIntentsForIntent[0] || {
          intent: { name: metadata.name, displayName: metadata.displayName || metadata.name },
          apps: [],
        }
      )
    })

    const response = createDACPSuccessResponse(request, "findIntentsByContextResponse", {
      appIntents,
    })

    // Add routing metadata
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        destination: { instanceId },
      },
    }

    transport.send(responseWithRouting)
  } catch (error) {
    logger.error("DACP: Find intents by context request failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.NO_APPS_FOUND,
      "findIntentsByContextResponse",
      error instanceof Error ? error.message : "Failed to find intents for context type"
    )
    // Add routing metadata
    const errorResponseWithRouting = {
      ...errorResponse,
      meta: {
        ...errorResponse.meta,
        destination: { instanceId },
      },
    }

    transport.send(errorResponseWithRouting)
  }
}

export async function handleRaiseIntentForContextRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, appInstanceRegistry, intentRegistry } = context

  try {
    const request = validateDACPMessage(message, RaiseIntentForContextRequestSchema)

    logger.info("DACP: Processing raise intent for context request", {
      requestUuid: request.meta.requestUuid,
    })

    // app is an AppIdentifier object (with appId, instanceId, desktopAgent)
    const validatedContext = validateDACPMessage(request.payload.context, ContextSchema)
    const source = appInstanceRegistry.getInstance(instanceId)

    if (!source) {
      throw new Error(`Source instance ${instanceId} not found`)
    }

    // Find all intents that can handle this context type
    const intentMetadata = intentRegistry.findIntentsByContext(validatedContext.type)

    if (intentMetadata.length === 0) {
      throw new Error(`No intents found to handle context type: ${validatedContext.type}`)
    }

    // For now, use the first intent found
    // TODO: Implement UI resolution when multiple intents exist
    const selectedIntent = intentMetadata[0].name

    logger.info("DACP: Selected intent for context", {
      intent: selectedIntent,
      contextType: validatedContext.type,
    })

    // Find handlers for this intent
    const handlers = intentRegistry.findIntentHandlers({
      intent: selectedIntent,
      context: validatedContext,
      source: { appId: source.appId, instanceId: source.instanceId },
      target: request.payload.app, // app is already an AppIdentifier object
      requestId: request.meta.requestUuid,
    })

    if (handlers.compatibleApps.length === 0) {
      throw new Error(`No apps found to handle intent: ${selectedIntent}`)
    }

    // Select target (prefer running listeners)
    let targetInstanceId: string
    let targetAppId: string

    if (handlers.runningListeners.length > 0) {
      const listener = handlers.runningListeners[0]
      targetInstanceId = listener.instanceId
      targetAppId = listener.appId
    } else if (handlers.availableApps.length > 0) {
      const appCapability = handlers.availableApps[0]
      targetAppId = appCapability.appId
      targetInstanceId = await launchAppAndWaitForInstance(targetAppId, context, validatedContext)
    } else {
      throw new Error(`No handler found for intent: ${selectedIntent}`)
    }

    // Register pending intent
    const resultPromise = intentRegistry.registerPendingIntent({
      requestId: request.meta.requestUuid,
      intentName: selectedIntent,
      context: validatedContext,
      sourceInstanceId: instanceId,
      targetInstanceId,
      targetAppId,
      timeoutMs: 30000,
    })

    // Send intentEvent to target app
    const intentEvent = createIntentEvent(
      selectedIntent,
      validatedContext,
      request.meta.requestUuid,
      {
        appId: source.appId,
        instanceId: source.instanceId,
      }
    )

    logger.info("DACP: Sending intentEvent for context-first intent", {
      targetInstanceId,
      intent: selectedIntent,
      contextType: validatedContext.type,
    })

    // Add routing metadata
    const intentEventWithRouting = {
      ...intentEvent,
      meta: {
        ...intentEvent.meta,
        destination: { instanceId: targetInstanceId },
      },
    }

    transport.send(intentEventWithRouting)

    // Wait for result
    await resultPromise

    // Get target app instance information
    const targetInstance = appInstanceRegistry.getInstance(targetInstanceId)
    if (!targetInstance) {
      throw new Error(`Target instance ${targetInstanceId} not found`)
    }

    // Send response with intentResolution
    const response = createDACPSuccessResponse(request, "raiseIntentForContextResponse", {
      intentResolution: {
        source: {
          appId: targetInstance.appId,
          instanceId: targetInstance.instanceId,
        },
        intent: selectedIntent,
      },
    })

    // Add routing metadata
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        destination: { instanceId },
      },
    }

    transport.send(responseWithRouting)
  } catch (error) {
    logger.error("DACP: Raise intent for context request failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.INTENT_DELIVERY_FAILED,
      "raiseIntentForContextResponse",
      error instanceof Error ? error.message : "Intent delivery failed"
    )
    // Add routing metadata
    const errorResponseWithRouting = {
      ...errorResponse,
      meta: {
        ...errorResponse.meta,
        destination: { instanceId },
      },
    }

    transport.send(errorResponseWithRouting)
  }
}
