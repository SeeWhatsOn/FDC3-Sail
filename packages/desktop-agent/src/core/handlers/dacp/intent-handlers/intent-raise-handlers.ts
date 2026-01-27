/**
 * Intent Raise Handlers
 *
 * Handlers for raising intents (raiseIntent and raiseIntentForContext)
 */

import {
  createDACPSuccessResponse,
  createIntentEvent,
} from "../../../dacp-protocol/dacp-message-creators"
import { type DACPHandlerContext, type IntentHandlerOption } from "../../types"
import { sendDACPResponse, sendDACPErrorResponse } from "../utils/dacp-response-utils"
import type { BrowserTypes, Context } from "@finos/fdc3"
import { ResolveError } from "@finos/fdc3"
import { AppInstanceState } from "../../../state/types"
import {
  NoAppsFoundError,
  TargetAppUnavailableError,
  TargetInstanceUnavailableError,
  UserCancelledError,
  FDC3ResolveError,
} from "../../../errors/fdc3-errors"
import { getInstance, getListenersForInstance } from "../../../state/selectors"
import { addPendingIntent, resolvePendingIntent } from "../../../state/mutators"
import {
  findIntentHandlers,
  findIntentsByContext,
  launchAppAndWaitForInstance,
  pendingIntentPromises,
} from "./intent-helpers"

export async function handleRaiseIntentRequest(
  message: BrowserTypes.RaiseIntentRequest,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, getState, setState, appDirectory, logger } = context

  try {
    const payload = message.payload

    const contextPayload = payload.context as Record<string, unknown>
    logger.info("DACP: Processing raise intent request", {
      intent: payload.intent,
      requestUuid: message.meta.requestUuid,
      contextType: contextPayload?.type,
      contextKeys: contextPayload ? Object.keys(contextPayload) : [],
      hasName: typeof contextPayload?.name === "string",
      contextPayload: JSON.stringify(contextPayload),
    })

    const validatedContext: Context = payload.context

    const validatedContextRecord = validatedContext as Record<string, unknown>
    logger.debug("DACP: Context validated successfully", {
      contextType: validatedContext.type,
      hasId: !!validatedContext.id,
      hasName: typeof validatedContextRecord.name === "string",
      contextKeys: Object.keys(validatedContextRecord),
      validatedContext: JSON.stringify(validatedContextRecord),
    })

    // Validate target app/instance BEFORE attempting delivery
    if (payload.app) {
      const targetAppId = typeof payload.app === "string" ? payload.app : payload.app.appId
      const targetInstanceId = typeof payload.app === "object" ? payload.app.instanceId : undefined

      // Check if app exists in directory
      const apps = appDirectory.retrieveAppsById(targetAppId)
      if (apps.length === 0) {
        throw new TargetAppUnavailableError(`App not found in directory: ${targetAppId}`)
      }

      // Check if specific instance exists (if specified)
      if (targetInstanceId) {
        const state = getState()
        const instance = getInstance(state, targetInstanceId)
        if (!instance || instance.state === AppInstanceState.TERMINATED) {
          throw new TargetInstanceUnavailableError(
            `Instance not found or terminated: ${targetInstanceId}`
          )
        }
      }
    }

    const source = getInstance(getState(), instanceId)

    if (!source) {
      throw new Error(`Source instance ${instanceId} not found`)
    }

    // Find intent handlers for this request
    const state = getState()
    const handlers = findIntentHandlers(state, appDirectory, {
      intent: payload.intent,
      context: validatedContext,
      source: { appId: source.appId, instanceId: source.instanceId },
      target: typeof payload.app === "string" ? { appId: payload.app } : payload.app,
    })

    // Safety check: Filter out listeners whose instances no longer exist
    // This prevents zombie instances from appearing in the resolver
    const originalRunningCount = handlers.runningListeners.length
    const validRunningListeners = handlers.runningListeners.filter(listener => {
      const instance = getInstance(state, listener.instanceId)
      if (!instance) {
        logger.warn("DACP: Found listener for non-existent instance, filtering out", {
          listenerId: listener.listenerId,
          instanceId: listener.instanceId,
          appId: listener.appId,
          intent: payload.intent,
        })
        return false
      }
      if (instance.state === AppInstanceState.TERMINATED) {
        logger.warn("DACP: Found listener for terminated instance, filtering out", {
          listenerId: listener.listenerId,
          instanceId: listener.instanceId,
          appId: listener.appId,
          intent: payload.intent,
        })
        return false
      }
      return true
    })

    // Rebuild handlers with filtered running listeners if any were filtered
    // We need to rebuild compatibleApps because it's built from runningListeners + availableApps
    // If we filtered out zombie listeners, compatibleApps would still contain them
    const finalHandlers =
      validRunningListeners.length !== originalRunningCount
        ? (() => {
            const runningAppIds = new Set(validRunningListeners.map(l => l.appId))
            logger.info("DACP: Filtered out zombie listeners", {
              originalCount: originalRunningCount,
              validCount: validRunningListeners.length,
              filteredCount: originalRunningCount - validRunningListeners.length,
            })
            return {
              ...handlers,
              runningListeners: validRunningListeners,
              // Rebuild compatibleApps with filtered runningListeners to remove zombie instances
              compatibleApps: [
                ...validRunningListeners,
                ...handlers.availableApps.filter(app => !runningAppIds.has(app.appId)),
              ],
            }
          })()
        : handlers

    logger.info("DACP: Intent handlers found", {
      intent: payload.intent,
      runningListeners: finalHandlers.runningListeners.length,
      availableApps: finalHandlers.availableApps.length,
      compatibleApps: finalHandlers.compatibleApps.length,
      contextType: validatedContext.type,
      hasName: typeof (validatedContext as Record<string, unknown>).name === "string",
    })

    // Check if we have any compatible handlers
    if (finalHandlers.compatibleApps.length === 0) {
      logger.error("DACP: No compatible handlers found", {
        intent: payload.intent,
        contextType: validatedContext.type,
        runningListeners: finalHandlers.runningListeners.length,
        availableApps: finalHandlers.availableApps.length,
      })
      throw new NoAppsFoundError(`No apps found to handle intent: ${payload.intent}`)
    }

    let targetInstanceId: string
    let targetAppId: string

    // Check if we need UI resolution (multiple handlers available)
    const needsResolution =
      finalHandlers.compatibleApps.length > 1 && context.requestIntentResolution

    if (needsResolution) {
      // Build handler options for UI with app metadata
      const handlerOptions: IntentHandlerOption[] = finalHandlers.compatibleApps.map(handler => {
        const isRunning = "instanceId" in handler
        const apps = appDirectory.retrieveAppsById(handler.appId)
        const appInfo = apps[0] // Take first matching app
        return {
          appId: handler.appId,
          instanceId: isRunning ? handler.instanceId : undefined,
          title: appInfo?.title ?? handler.appId,
          name: appInfo?.name,
          description: appInfo?.description,
          icons: appInfo?.icons,
          isRunning,
        }
      })

      logger.info("DACP: Multiple handlers found, requesting UI resolution", {
        intent: payload.intent,
        handlerCount: handlerOptions.length,
      })

      // Request UI resolution
      const resolution = await context.requestIntentResolution!({
        requestId: message.meta.requestUuid,
        intent: payload.intent,
        context: validatedContext,
        handlers: handlerOptions,
      })

      if (!resolution.selectedHandler) {
        throw new UserCancelledError("Intent resolution cancelled by user")
      }

      targetAppId = resolution.selectedHandler.appId

      // Re-query handlers after user selection to get current state
      // (apps may have been launched/closed while user was selecting)
      const currentState = getState()
      const currentHandlers = findIntentHandlers(currentState, appDirectory, {
        intent: payload.intent,
        context: validatedContext,
        source: { appId: source.appId, instanceId: source.instanceId },
        target: { appId: targetAppId },
      })

      // Check if there's a running instance for the selected app
      const runningInstance = currentHandlers.runningListeners.find(
        listener => listener.appId === targetAppId
      )

      if (resolution.selectedHandler.instanceId) {
        // User selected a specific running instance - verify it still exists
        const selectedInstance = getInstance(currentState, resolution.selectedHandler.instanceId)
        if (selectedInstance && selectedInstance.state !== AppInstanceState.TERMINATED) {
          targetInstanceId = resolution.selectedHandler.instanceId
          logger.info("DACP: Using user-selected running instance", {
            targetInstanceId,
            targetAppId,
            instanceState: selectedInstance.state,
          })

          // Verify intent listener is registered on the selected instance
          const listeners = getListenersForInstance(currentState, targetInstanceId).filter(
            l => l.intentName === payload.intent && l.active
          )

          if (listeners.length === 0) {
            logger.warn(
              "DACP: No intent listener found on selected instance, waiting for registration",
              {
                targetInstanceId,
                intent: payload.intent,
              }
            )

            // Wait for listener to be registered (max 5 seconds for running instances)
            const listenerWaitTime = 5000
            const listenerCheckInterval = 100
            const listenerWaitStart = Date.now()
            let listenerRegistered = false

            while (Date.now() - listenerWaitStart < listenerWaitTime) {
              const waitState = getState()
              const currentListeners = getListenersForInstance(waitState, targetInstanceId).filter(
                l => l.intentName === payload.intent && l.active
              )

              if (currentListeners.length > 0) {
                listenerRegistered = true
                logger.info("DACP: Intent listener found on selected instance", {
                  targetInstanceId,
                  intent: payload.intent,
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
                  intent: payload.intent,
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
        const listeners = getListenersForInstance(currentState, targetInstanceId).filter(
          l => l.intentName === payload.intent && l.active
        )

        if (listeners.length === 0) {
          logger.warn(
            "DACP: No intent listener found on running instance, waiting for registration",
            {
              targetInstanceId,
              intent: payload.intent,
            }
          )

          // Wait for listener to be registered (max 5 seconds for running instances)
          const listenerWaitTime = 5000
          const listenerCheckInterval = 100
          const listenerWaitStart = Date.now()
          let listenerRegistered = false

          while (Date.now() - listenerWaitStart < listenerWaitTime) {
            const waitState = getState()
            const currentListeners = getListenersForInstance(waitState, targetInstanceId).filter(
              l => l.intentName === payload.intent && l.active
            )

            if (currentListeners.length > 0) {
              listenerRegistered = true
              logger.info("DACP: Intent listener found on running instance", {
                targetInstanceId,
                intent: payload.intent,
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
                intent: payload.intent,
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
          intent: payload.intent,
        })

        const listenerWaitTime = 15000 // 15 seconds (FDC3 spec minimum)
        const listenerCheckInterval = 100 // Check every 100ms
        const listenerWaitStart = Date.now()
        let listenerRegistered = false

        while (Date.now() - listenerWaitStart < listenerWaitTime) {
          // Check if a listener has been registered for this intent on this instance
          const waitState = getState()
          const listeners = getListenersForInstance(waitState, targetInstanceId).filter(
            l => l.intentName === payload.intent && l.active
          )

          if (listeners.length > 0) {
            listenerRegistered = true
            logger.info("DACP: Intent listener registered (UI resolution path)", {
              targetInstanceId,
              intent: payload.intent,
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
              intent: payload.intent,
              timeout: listenerWaitTime,
            }
          )
          // Continue anyway - the app might handle the intent event when it registers the listener
        }
      }
    } else if (finalHandlers.runningListeners.length > 0) {
      // Single handler or no UI - use a running listener (preferred)
      const listener = finalHandlers.runningListeners[0]
      targetInstanceId = listener.instanceId
      targetAppId = listener.appId
      logger.info("DACP: Using running listener", {
        targetInstanceId,
        targetAppId,
        intent: payload.intent,
        contextType: validatedContext.type,
        hasName: typeof (validatedContext as Record<string, unknown>).name === "string",
      })
    } else if (finalHandlers.availableApps.length > 0) {
      // Need to launch an app
      const appCapability = finalHandlers.availableApps[0]
      targetAppId = appCapability.appId
      logger.info("DACP: Launching app for intent", {
        targetAppId,
        intent: payload.intent,
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
        intent: payload.intent,
      })

      const listenerWaitTime = 15000 // 15 seconds (FDC3 spec minimum)
      const listenerCheckInterval = 100 // Check every 100ms
      const listenerWaitStart = Date.now()
      let listenerRegistered = false

      while (Date.now() - listenerWaitStart < listenerWaitTime) {
        // Check if a listener has been registered for this intent on this instance
        const waitState = getState()
        const listeners = getListenersForInstance(waitState, targetInstanceId).filter(
          l => l.intentName === payload.intent && l.active
        )

        if (listeners.length > 0) {
          listenerRegistered = true
          logger.info("DACP: Intent listener registered", {
            targetInstanceId,
            intent: payload.intent,
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
            intent: payload.intent,
            timeout: listenerWaitTime,
          }
        )
        // Continue anyway - the app might handle the intent event when it registers the listener
        // or the app might be using a different mechanism to handle intents
      }
    } else {
      throw new NoAppsFoundError(`No handler found for intent: ${payload.intent}`)
    }

    // Register pending intent for intentResultRequest correlation.
    // We do not block the response on the intent result.
    const requestId = message.meta.requestUuid
    pendingIntentPromises.set(requestId, {
      resolve: () => {},
      reject: () => {},
    })

    // Store pending intent metadata in state (without promise functions)
    setState(state =>
      addPendingIntent(state, {
        requestId,
        intentName: payload.intent,
        context: validatedContext,
        sourceInstanceId: instanceId,
        targetInstanceId,
        targetAppId,
      })
    )

    // Send intentEvent to target app
    const intentEvent = createIntentEvent(payload.intent, validatedContext, requestId, {
      appId: source.appId,
      instanceId: source.instanceId,
    })

    logger.info("DACP: Sending intentEvent to target app", {
      targetInstanceId,
      targetAppId,
      intent: payload.intent,
      requestUuid: requestId,
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
    const targetInstanceForEvent = getInstance(getState(), targetInstanceId)
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
        const waitState = getState()
        const instance = getInstance(waitState, targetInstanceId)
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
      const finalState = getState()
      const finalInstance = getInstance(finalState, targetInstanceId)
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

    logger.info("DACP: intentEvent sent, responding to source app", {
      targetInstanceId,
      requestUuid: requestId,
    })

    // Send response back to source app with intentResolution (non-blocking).
    const response = createDACPSuccessResponse(message, "raiseIntentResponse", {
      intentResolution: {
        source: {
          appId: targetAppId,
          instanceId: targetInstanceId,
        },
        intent: payload.intent,
      },
    })

    sendDACPResponse({ response, instanceId, transport })

    // Set up timeout to clean up pending intent if no result arrives.
    const timeoutHandle = setTimeout(() => {
      if (pendingIntentPromises.has(requestId)) {
        pendingIntentPromises.delete(requestId)
        setState(state => resolvePendingIntent(state, requestId))
      }
    }, 30000)

    // Store timeout handle
    const promiseData = pendingIntentPromises.get(requestId)
    if (promiseData) {
      promiseData.timeoutHandle = timeoutHandle
    }
  } catch (error) {
    const payload = message.payload
    const context = payload?.context as Record<string, unknown> | undefined

    logger.error("DACP: Raise intent request failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      contextType: context?.type,
      contextHasName: typeof context?.name === "string",
    })

    // Determine error type from error instance
    let errorType: ResolveError = ResolveError.IntentDeliveryFailed
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (error instanceof FDC3ResolveError) {
      errorType = error.errorType
    } else if (
      errorMessage.includes("No apps found") ||
      errorMessage.includes("No handler found")
    ) {
      errorType = ResolveError.NoAppsFound
    } else if (errorMessage.includes("App not found in directory")) {
      errorType = ResolveError.TargetAppUnavailable
    } else if (errorMessage.includes("not found") && errorMessage.includes("instance")) {
      errorType = ResolveError.TargetInstanceUnavailable
    } else if (errorMessage.includes("cancelled by user")) {
      errorType = ResolveError.UserCancelled
    }

    sendDACPErrorResponse({
      message,
      errorType,
      errorMessage,
      instanceId,
      transport,
    })
  }
}

export async function handleRaiseIntentForContextRequest(
  message: BrowserTypes.RaiseIntentForContextRequest,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, getState, setState, appDirectory, logger } = context

  try {
    const payload = message.payload

    logger.info("DACP: Processing raise intent for context request", {
      requestUuid: message.meta.requestUuid,
    })

    // app is an AppIdentifier object (with appId, instanceId, desktopAgent)
    const validatedContext = payload.context

    // Validate target app/instance BEFORE attempting delivery
    if (payload.app) {
      const targetAppId = payload.app.appId
      const targetInstanceId = payload.app.instanceId

      // Check if app exists in directory
      const apps = appDirectory.retrieveAppsById(targetAppId)
      if (apps.length === 0) {
        throw new TargetAppUnavailableError(`App not found in directory: ${targetAppId}`)
      }

      // Check if specific instance exists (if specified)
      if (targetInstanceId) {
        const state = getState()
        const instance = getInstance(state, targetInstanceId)
        if (!instance || instance.state === AppInstanceState.TERMINATED) {
          throw new TargetInstanceUnavailableError(
            `Instance not found or terminated: ${targetInstanceId}`
          )
        }
      }
    }

    const source = getInstance(getState(), instanceId)

    if (!source) {
      throw new Error(`Source instance ${instanceId} not found`)
    }

    // Find all intents that can handle this context type
    const intentMetadata = findIntentsByContext(getState(), appDirectory, validatedContext.type)

    if (intentMetadata.length === 0) {
      throw new NoAppsFoundError(
        `No intents found to handle context type: ${validatedContext.type}`
      )
    }

    // For now, use the first intent found
    // TODO: Implement UI resolution when multiple intents exist
    const selectedIntent = intentMetadata[0].name

    logger.info("DACP: Selected intent for context", {
      intent: selectedIntent,
      contextType: validatedContext.type,
    })

    // Find handlers for this intent
    const state = getState()
    const handlers = findIntentHandlers(state, appDirectory, {
      intent: selectedIntent,
      context: validatedContext,
      source: { appId: source.appId, instanceId: source.instanceId },
      target: payload.app, // app is already an AppIdentifier object
    })

    if (handlers.compatibleApps.length === 0) {
      throw new NoAppsFoundError(`No apps found to handle intent: ${selectedIntent}`)
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
        const waitState = getState()
        const listeners = getListenersForInstance(waitState, targetInstanceId).filter(
          l => l.intentName === selectedIntent && l.active
        )

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
      throw new NoAppsFoundError(`No handler found for intent: ${selectedIntent}`)
    }

    // Register pending intent for intentResultRequest correlation.
    const requestId = message.meta.requestUuid
    pendingIntentPromises.set(requestId, {
      resolve: () => {},
      reject: () => {},
    })

    // Store pending intent metadata in state (without promise functions)
    setState(state =>
      addPendingIntent(state, {
        requestId,
        intentName: selectedIntent,
        context: validatedContext,
        sourceInstanceId: instanceId,
        targetInstanceId,
        targetAppId,
      })
    )

    // Set up timeout to clean up pending intent if no result arrives.
    const timeoutHandle = setTimeout(() => {
      if (pendingIntentPromises.has(requestId)) {
        pendingIntentPromises.delete(requestId)
        setState(state => resolvePendingIntent(state, requestId))
      }
    }, 30000)

    const promiseData = pendingIntentPromises.get(requestId)
    if (promiseData) {
      promiseData.timeoutHandle = timeoutHandle
    }

    // Send intentEvent to target app
    const intentEvent = createIntentEvent(selectedIntent, validatedContext, requestId, {
      appId: source.appId,
      instanceId: source.instanceId,
    })

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

    // Send response with intentResolution (non-blocking).
    const response = createDACPSuccessResponse(message, "raiseIntentForContextResponse", {
      intentResolution: {
        source: {
          appId: targetAppId,
          instanceId: targetInstanceId,
        },
        intent: selectedIntent,
      },
    })

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Raise intent for context request failed", error)

    // Determine error type from error instance
    let errorType: ResolveError = ResolveError.IntentDeliveryFailed
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (error instanceof FDC3ResolveError) {
      errorType = error.errorType
    } else if (
      errorMessage.includes("No apps found") ||
      errorMessage.includes("No handler found") ||
      errorMessage.includes("No intents found")
    ) {
      errorType = ResolveError.NoAppsFound
    } else if (errorMessage.includes("App not found in directory")) {
      errorType = ResolveError.TargetAppUnavailable
    } else if (errorMessage.includes("not found") && errorMessage.includes("instance")) {
      errorType = ResolveError.TargetInstanceUnavailable
    } else if (errorMessage.includes("cancelled by user")) {
      errorType = ResolveError.UserCancelled
    }

    sendDACPErrorResponse({
      message,
      errorType,
      errorMessage,
      instanceId,
      transport,
    })
  }
}
