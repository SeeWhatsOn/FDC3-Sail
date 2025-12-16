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
 *
 * Per FDC3 spec: "Allow, by default, at least a 15 second timeout for an application,
 * launched via fdc3.open, fdc3.raiseIntent or fdc3.raiseIntentForContext to add any
 * context listener (via fdc3.addContextListener) or intent listener (via fdc3.addIntentListener)
 * necessary to deliver context or intent and context to it on launch."
 *
 * This function waits for any NEW instance of the app to be created and connected,
 * rather than waiting for a specific instanceId, since the Desktop Agent may create
 * a different instanceId than what the launcher returns.
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

  // Track existing instances BEFORE launch to identify the new one
  const existingInstances = appInstanceRegistry.queryInstances({ appId })
  const existingInstanceIds = new Set(existingInstances.map(i => i.instanceId))

  // Launch the app
  const launchResult = await appLauncher.launch(
    {
      app: { appId },
      context: validatedContext as Context | undefined,
    },
    appMetadata
  )

  const launcherInstanceId = launchResult.appIdentifier.instanceId
  if (!launcherInstanceId) {
    throw new Error("App launcher did not return an instance ID")
  }

  // Set timestamp AFTER launch completes to catch instances created during/after launch
  // Use a small buffer to account for any timing differences
  const launchTimestamp = Date.now() - 500 // 500ms before to catch instances created during launch

  logger.info("DACP: App launched, waiting for new instance registration", {
    appId,
    launcherInstanceId,
    existingInstances: existingInstanceIds.size,
    launchTimestamp,
  })

  // Wait for a NEW instance to be registered and connected
  // Per FDC3 spec: at least 15 seconds timeout
  const maxWaitTime = 15000 // 15 seconds (FDC3 spec minimum)
  const checkInterval = 100 // Check every 100ms
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    // Query for all instances of this app
    const allInstances = appInstanceRegistry.queryInstances({ appId })
    const elapsed = Date.now() - startTime

    // Log all instances periodically (every 2 seconds) for debugging
    const shouldLog =
      elapsed < checkInterval * 2 ||
      Math.floor(elapsed / 2000) !== Math.floor((elapsed - checkInterval) / 2000)
    if (shouldLog) {
      logger.debug("DACP: Checking for new instance", {
        appId,
        elapsedMs: elapsed,
        totalInstances: allInstances.length,
        existingCount: existingInstanceIds.size,
        instances: allInstances.map(i => ({
          instanceId: i.instanceId,
          state: i.state,
          createdAt: i.createdAt.getTime(),
          isNew: !existingInstanceIds.has(i.instanceId),
          isRecent: i.createdAt.getTime() >= launchTimestamp,
          isReady: i.state === AppInstanceState.CONNECTED || i.state === AppInstanceState.PENDING,
          matchesLauncher: i.instanceId === launcherInstanceId,
        })),
        launcherInstanceId,
        launchTimestamp,
        currentTime: Date.now(),
      })
    }

    // Find a new instance (not in the existing set)
    // Accept PENDING or CONNECTED state - PENDING means WCP handshake complete and ready to receive messages
    // The 15 second timeout allows the app to add listeners per FDC3 spec
    const newInstance = allInstances.find(instance => {
      const isNew = !existingInstanceIds.has(instance.instanceId)
      const isRecent = instance.createdAt.getTime() >= launchTimestamp
      const isReady =
        instance.state === AppInstanceState.CONNECTED || instance.state === AppInstanceState.PENDING

      if (isNew && isRecent && !isReady) {
        logger.debug("DACP: Found new instance but not ready yet", {
          instanceId: instance.instanceId,
          state: instance.state,
          createdAt: instance.createdAt.getTime(),
          launchTimestamp,
        })
      }

      return isNew && isRecent && isReady
    })

    if (newInstance) {
      logger.info("DACP: New app instance registered and ready", {
        appId,
        instanceId: newInstance.instanceId,
        launcherInstanceId,
        state: newInstance.state,
        elapsedMs: Date.now() - startTime,
      })
      return newInstance.instanceId
    }

    // Also check if the launcher's instanceId exists (PENDING or CONNECTED) for compatibility
    const launcherInstance = appInstanceRegistry.getInstance(launcherInstanceId)
    if (
      launcherInstance &&
      (launcherInstance.state === AppInstanceState.CONNECTED ||
        launcherInstance.state === AppInstanceState.PENDING)
    ) {
      logger.info("DACP: Launcher instance registered and ready", {
        appId,
        instanceId: launcherInstanceId,
        state: launcherInstance.state,
      })
      return launcherInstanceId
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval))
  }

  // Log debug info before throwing
  const finalInstances = appInstanceRegistry.queryInstances({ appId })
  logger.error("DACP: Timeout waiting for new instance", {
    appId,
    launcherInstanceId,
    existingInstancesBeforeLaunch: existingInstanceIds.size,
    currentInstances: finalInstances.length,
    currentInstanceStates: finalInstances.map(i => ({
      instanceId: i.instanceId,
      state: i.state,
      createdAt: i.createdAt.getTime(),
      launchTimestamp,
    })),
  })

  throw new Error(
    `No new instance of app ${appId} registered and connected within ${maxWaitTime}ms (FDC3 spec minimum timeout)`
  )
}

export async function handleRaiseIntentRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, appInstanceRegistry, intentRegistry, appDirectory } = context

  try {
    const request = validateDACPMessage(message, RaiseIntentRequestSchema)

    const contextPayload = request.payload.context as Record<string, unknown>
    logger.info("DACP: Processing raise intent request", {
      intent: request.payload.intent,
      requestUuid: request.meta.requestUuid,
      contextType: contextPayload?.type,
      contextKeys: contextPayload ? Object.keys(contextPayload) : [],
      hasName: typeof contextPayload?.name === "string",
      contextPayload: JSON.stringify(contextPayload),
    })

    let validatedContext: Context
    try {
      validatedContext = validateDACPMessage(request.payload.context, ContextSchema)
    } catch (validationError) {
      // Extract detailed validation error information
      const errorMessage =
        validationError instanceof Error ? validationError.message : String(validationError)

      logger.error("DACP: Context validation failed", {
        error: errorMessage,
        contextPayload: JSON.stringify(contextPayload, null, 2),
        contextType: contextPayload?.type,
        hasName: typeof contextPayload?.name === "string",
        nameValue: contextPayload?.name,
        nameType: typeof contextPayload?.name,
        allContextKeys: contextPayload ? Object.keys(contextPayload) : [],
        contextStructure: contextPayload,
      })
      throw validationError
    }

    const validatedContextRecord = validatedContext as Record<string, unknown>
    logger.debug("DACP: Context validated successfully", {
      contextType: validatedContext.type,
      hasId: !!validatedContext.id,
      hasName: typeof validatedContextRecord.name === "string",
      contextKeys: Object.keys(validatedContextRecord),
      validatedContext: JSON.stringify(validatedContextRecord),
    })
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

    logger.info("DACP: Intent handlers found", {
      intent: request.payload.intent,
      runningListeners: handlers.runningListeners.length,
      availableApps: handlers.availableApps.length,
      compatibleApps: handlers.compatibleApps.length,
      contextType: validatedContext.type,
      hasName: typeof (validatedContext as Record<string, unknown>).name === "string",
    })

    // Check if we have any compatible handlers
    if (handlers.compatibleApps.length === 0) {
      logger.error("DACP: No compatible handlers found", {
        intent: request.payload.intent,
        contextType: validatedContext.type,
        runningListeners: handlers.runningListeners.length,
        availableApps: handlers.availableApps.length,
      })
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

      // Re-query handlers after user selection to get current state
      // (apps may have been launched/closed while user was selecting)
      const currentHandlers = intentRegistry.findIntentHandlers({
        intent: request.payload.intent,
        context: validatedContext,
        source: { appId: source.appId, instanceId: source.instanceId },
        target: { appId: targetAppId },
        requestId: request.meta.requestUuid,
      })

      // Check if there's a running instance for the selected app
      const runningInstance = currentHandlers.runningListeners.find(
        listener => listener.appId === targetAppId
      )

      if (resolution.selectedHandler.instanceId) {
        // User selected a specific running instance - verify it still exists
        const selectedInstance = appInstanceRegistry.getInstance(
          resolution.selectedHandler.instanceId
        )
        if (selectedInstance && selectedInstance.state !== AppInstanceState.TERMINATED) {
          targetInstanceId = resolution.selectedHandler.instanceId
          logger.info("DACP: Using user-selected running instance", {
            targetInstanceId,
            targetAppId,
            instanceState: selectedInstance.state,
          })

          // Verify intent listener is registered on the selected instance
          const listeners = intentRegistry.queryListeners({
            intentName: request.payload.intent,
            instanceId: targetInstanceId,
            active: true,
          })

          if (listeners.length === 0) {
            logger.warn(
              "DACP: No intent listener found on selected instance, waiting for registration",
              {
                targetInstanceId,
                intent: request.payload.intent,
              }
            )

            // Wait for listener to be registered (max 5 seconds for running instances)
            const listenerWaitTime = 5000
            const listenerCheckInterval = 100
            const listenerWaitStart = Date.now()
            let listenerRegistered = false

            while (Date.now() - listenerWaitStart < listenerWaitTime) {
              const currentListeners = intentRegistry.queryListeners({
                intentName: request.payload.intent,
                instanceId: targetInstanceId,
                active: true,
              })

              if (currentListeners.length > 0) {
                listenerRegistered = true
                logger.info("DACP: Intent listener found on selected instance", {
                  targetInstanceId,
                  intent: request.payload.intent,
                  listenerId: currentListeners[0].listenerId,
                })
                break
              }

              await new Promise(resolve => setTimeout(resolve, listenerCheckInterval))
            }

            if (!listenerRegistered) {
              logger.warn(
                "DACP: No intent listener registered on selected instance, sending intent event anyway",
                {
                  targetInstanceId,
                  intent: request.payload.intent,
                }
              )
            }
          }
        } else if (runningInstance) {
          // Selected instance no longer exists, but there's another running instance
          targetInstanceId = runningInstance.instanceId
          logger.warn("DACP: Selected instance no longer available, using other running instance", {
            selectedInstanceId: resolution.selectedHandler.instanceId,
            targetInstanceId,
            targetAppId,
          })
        } else {
          // Selected instance gone, need to launch new one
          logger.warn("DACP: Selected instance no longer available, launching new instance", {
            selectedInstanceId: resolution.selectedHandler.instanceId,
            targetAppId,
          })
          targetInstanceId = await launchAppAndWaitForInstance(
            targetAppId,
            context,
            validatedContext
          )
        }
      } else if (runningInstance) {
        // User selected app but no specific instance - use running instance if available
        targetInstanceId = runningInstance.instanceId
        logger.info("DACP: Using existing running instance for selected app", {
          targetInstanceId,
          targetAppId,
        })

        // Verify intent listener is registered on this instance
        const listeners = intentRegistry.queryListeners({
          intentName: request.payload.intent,
          instanceId: targetInstanceId,
          active: true,
        })

        if (listeners.length === 0) {
          logger.warn(
            "DACP: No intent listener found on running instance, waiting for registration",
            {
              targetInstanceId,
              intent: request.payload.intent,
            }
          )

          // Wait for listener to be registered (max 5 seconds for running instances)
          const listenerWaitTime = 5000
          const listenerCheckInterval = 100
          const listenerWaitStart = Date.now()
          let listenerRegistered = false

          while (Date.now() - listenerWaitStart < listenerWaitTime) {
            const currentListeners = intentRegistry.queryListeners({
              intentName: request.payload.intent,
              instanceId: targetInstanceId,
              active: true,
            })

            if (currentListeners.length > 0) {
              listenerRegistered = true
              logger.info("DACP: Intent listener found on running instance", {
                targetInstanceId,
                intent: request.payload.intent,
                listenerId: currentListeners[0].listenerId,
              })
              break
            }

            await new Promise(resolve => setTimeout(resolve, listenerCheckInterval))
          }

          if (!listenerRegistered) {
            logger.warn(
              "DACP: No intent listener registered on running instance, sending intent event anyway",
              {
                targetInstanceId,
                intent: request.payload.intent,
              }
            )
          }
        }
      } else {
        // Need to launch the app
        targetInstanceId = await launchAppAndWaitForInstance(targetAppId, context, validatedContext)

        // Per FDC3 spec: Allow time for app to add intent listener after launch
        // Wait up to 15 seconds for the app to register its intent listener
        logger.info("DACP: Waiting for app to register intent listener (UI resolution path)", {
          targetInstanceId,
          intent: request.payload.intent,
        })

        const listenerWaitTime = 15000 // 15 seconds (FDC3 spec minimum)
        const listenerCheckInterval = 100 // Check every 100ms
        const listenerWaitStart = Date.now()
        let listenerRegistered = false

        while (Date.now() - listenerWaitStart < listenerWaitTime) {
          // Check if a listener has been registered for this intent on this instance
          const listeners = intentRegistry.queryListeners({
            intentName: request.payload.intent,
            instanceId: targetInstanceId,
            active: true,
          })

          if (listeners.length > 0) {
            listenerRegistered = true
            logger.info("DACP: Intent listener registered (UI resolution path)", {
              targetInstanceId,
              intent: request.payload.intent,
              listenerId: listeners[0].listenerId,
            })
            break
          }

          await new Promise(resolve => setTimeout(resolve, listenerCheckInterval))
        }

        if (!listenerRegistered) {
          logger.warn(
            "DACP: No intent listener registered within timeout (UI resolution path), sending intent event anyway",
            {
              targetInstanceId,
              intent: request.payload.intent,
              timeout: listenerWaitTime,
            }
          )
          // Continue anyway - the app might handle the intent event when it registers the listener
        }
      }
    } else if (handlers.runningListeners.length > 0) {
      // Single handler or no UI - use a running listener (preferred)
      const listener = handlers.runningListeners[0]
      targetInstanceId = listener.instanceId
      targetAppId = listener.appId
      logger.info("DACP: Using running listener", {
        targetInstanceId,
        targetAppId,
        intent: request.payload.intent,
        contextType: validatedContext.type,
        hasName: typeof (validatedContext as Record<string, unknown>).name === "string",
      })
    } else if (handlers.availableApps.length > 0) {
      // Need to launch an app
      const appCapability = handlers.availableApps[0]
      targetAppId = appCapability.appId
      logger.info("DACP: Launching app for intent", {
        targetAppId,
        intent: request.payload.intent,
        contextType: validatedContext.type,
        hasName: typeof (validatedContext as Record<string, unknown>).name === "string",
      })
      targetInstanceId = await launchAppAndWaitForInstance(targetAppId, context, validatedContext)
      logger.info("DACP: App launched successfully", {
        targetInstanceId,
        targetAppId,
      })

      // Per FDC3 spec: Allow time for app to add intent listener after launch
      // Wait up to 15 seconds for the app to register its intent listener
      // This ensures the app is ready to receive the intent event
      logger.info("DACP: Waiting for app to register intent listener", {
        targetInstanceId,
        intent: request.payload.intent,
      })

      const listenerWaitTime = 15000 // 15 seconds (FDC3 spec minimum)
      const listenerCheckInterval = 100 // Check every 100ms
      const listenerWaitStart = Date.now()
      let listenerRegistered = false

      while (Date.now() - listenerWaitStart < listenerWaitTime) {
        // Check if a listener has been registered for this intent on this instance
        const listeners = intentRegistry.queryListeners({
          intentName: request.payload.intent,
          instanceId: targetInstanceId,
          active: true,
        })

        if (listeners.length > 0) {
          listenerRegistered = true
          logger.info("DACP: Intent listener registered", {
            targetInstanceId,
            intent: request.payload.intent,
            listenerId: listeners[0].listenerId,
          })
          break
        }

        await new Promise(resolve => setTimeout(resolve, listenerCheckInterval))
      }

      if (!listenerRegistered) {
        logger.warn(
          "DACP: No intent listener registered within timeout, sending intent event anyway",
          {
            targetInstanceId,
            intent: request.payload.intent,
            timeout: listenerWaitTime,
          }
        )
        // Continue anyway - the app might handle the intent event when it registers the listener
        // or the app might be using a different mechanism to handle intents
      }
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
      targetAppId,
      intent: request.payload.intent,
      requestUuid: request.meta.requestUuid,
      eventUuid: intentEvent.meta.eventUuid,
      hasDestination: true,
      contextType: validatedContext.type,
      contextHasName: typeof (validatedContext as Record<string, unknown>).name === "string",
      intentEventPayload: JSON.stringify(intentEvent.payload),
    })

    // Add routing metadata
    const intentEventWithRouting = {
      ...intentEvent,
      meta: {
        ...intentEvent.meta,
        destination: { instanceId: targetInstanceId },
      },
    }

    // Verify target instance exists and is ready before sending
    const targetInstanceForEvent = appInstanceRegistry.getInstance(targetInstanceId)
    if (!targetInstanceForEvent) {
      throw new Error(`Target instance ${targetInstanceId} not found when sending intent event`)
    }

    // Ensure instance is in a ready state (PENDING or CONNECTED)
    if (
      targetInstanceForEvent.state !== AppInstanceState.PENDING &&
      targetInstanceForEvent.state !== AppInstanceState.CONNECTED
    ) {
      logger.warn("DACP: Target instance not in ready state, waiting briefly", {
        targetInstanceId,
        targetState: targetInstanceForEvent.state,
      })
      // Wait a bit for instance to become ready (max 2 seconds)
      const maxWait = 2000
      const checkInterval = 100
      const startTime = Date.now()
      while (Date.now() - startTime < maxWait) {
        const instance = appInstanceRegistry.getInstance(targetInstanceId)
        if (
          instance &&
          (instance.state === AppInstanceState.PENDING ||
            instance.state === AppInstanceState.CONNECTED)
        ) {
          logger.info("DACP: Target instance became ready", {
            targetInstanceId,
            targetState: instance.state,
            waitedMs: Date.now() - startTime,
          })
          break
        }
        await new Promise(resolve => setTimeout(resolve, checkInterval))
      }

      // Re-check after waiting
      const finalInstance = appInstanceRegistry.getInstance(targetInstanceId)
      if (
        finalInstance &&
        finalInstance.state !== AppInstanceState.PENDING &&
        finalInstance.state !== AppInstanceState.CONNECTED
      ) {
        throw new Error(
          `Target instance ${targetInstanceId} is not in ready state: ${finalInstance.state}`
        )
      }
    }

    logger.info("DACP: Target instance verified, sending intentEvent", {
      targetInstanceId,
      targetAppId: targetInstanceForEvent.appId,
      targetState: targetInstanceForEvent.state,
      eventType: intentEventWithRouting.type,
    })

    transport.send(intentEventWithRouting)

    logger.info("DACP: intentEvent sent, waiting for intentResultRequest", {
      targetInstanceId,
      requestUuid: request.meta.requestUuid,
      timeoutMs: 30000,
    })

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
    const messageRecord = message as Record<string, unknown>
    const payload = messageRecord?.payload as Record<string, unknown> | undefined
    const context = payload?.context as Record<string, unknown> | undefined

    logger.error("DACP: Raise intent request failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      contextType: context?.type,
      contextHasName: typeof context?.name === "string",
    })
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

      // Per FDC3 spec: Allow time for app to add intent listener after launch
      // Wait up to 15 seconds for the app to register its intent listener
      logger.info("DACP: Waiting for app to register intent listener (context-first)", {
        targetInstanceId,
        intent: selectedIntent,
      })

      const listenerWaitTime = 15000 // 15 seconds (FDC3 spec minimum)
      const listenerCheckInterval = 100 // Check every 100ms
      const listenerWaitStart = Date.now()
      let listenerRegistered = false

      while (Date.now() - listenerWaitStart < listenerWaitTime) {
        const listeners = intentRegistry.queryListeners({
          intentName: selectedIntent,
          instanceId: targetInstanceId,
          active: true,
        })

        if (listeners.length > 0) {
          listenerRegistered = true
          logger.info("DACP: Intent listener registered (context-first)", {
            targetInstanceId,
            intent: selectedIntent,
            listenerId: listeners[0].listenerId,
          })
          break
        }

        await new Promise(resolve => setTimeout(resolve, listenerCheckInterval))
      }

      if (!listenerRegistered) {
        logger.warn(
          "DACP: No intent listener registered within timeout (context-first), sending intent event anyway",
          {
            targetInstanceId,
            intent: selectedIntent,
            timeout: listenerWaitTime,
          }
        )
      }
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
