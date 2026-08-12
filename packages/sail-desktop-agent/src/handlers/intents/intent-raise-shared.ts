import type { AppIdentifier, Context } from "@finos/fdc3"
import { ResolveError, ResultError } from "@finos/fdc3"
import { createDACPErrorResponse } from "../../dacp/dacp-message-creators"
import { addPendingIntent, resolvePendingIntent } from "../../state/mutators"
import { getInstance, getInstancesByAppId, getPendingIntent } from "../../state/selectors"
import { AppInstanceState, type PendingIntent } from "../../state/types"
import {
  FDC3ResolveError,
  NoAppsFoundError,
  TargetAppUnavailableError,
  TargetInstanceUnavailableError,
} from "../../errors/fdc3-errors"
import { attemptIntentDelivery, queueIntentDelivery } from "./intent-delivery-helpers"
import { retrieveAppsById } from "../../app-directory/app-directory-queries"
import type { DACPHandlerContext } from "../types"
import { sendDACPResponse } from "../utils/dacp-response-utils"
import {
  clearPendingIntentTimeouts,
  registerPendingIntentTimeout,
  releasePendingIntentTimeout,
} from "./intent-pending-timeout-registry"
import { shouldWaitForIntentListenerBeforeDelivery } from "./intent-helpers"
import { launchAppAndWaitForInstance } from "./intent-launch-helpers"

type ResolveAppTargetInstanceOptions = {
  appId: string
  validatedContext: Context
  preferredInstanceId?: string
  runningListenerInstanceId?: string
  forceLaunch?: boolean
}

export function normalizeTargetApp(target: unknown): AppIdentifier | undefined {
  if (!target) {
    return undefined
  }

  if (typeof target === "string") {
    return { appId: target }
  }

  if (typeof target !== "object") {
    return undefined
  }

  const record = target as Record<string, unknown>
  if (typeof record.appId !== "string") {
    return undefined
  }

  return {
    appId: record.appId,
    instanceId: typeof record.instanceId === "string" ? record.instanceId : undefined,
  }
}

export function validateRequestedTargetAvailability(
  context: DACPHandlerContext,
  targetApp: AppIdentifier | undefined,
): void {
  if (!targetApp) {
    return
  }

  const apps = retrieveAppsById(context.getState().appDirectory, targetApp.appId)
  if (apps.length === 0) {
    throw new TargetAppUnavailableError(`App not found in directory: ${targetApp.appId}`)
  }

  if (!targetApp.instanceId) {
    return
  }

  const instance = getInstance(context.getState(), targetApp.instanceId)
  if (!instance) {
    throw new TargetInstanceUnavailableError(
      `Instance not found or terminated: ${targetApp.instanceId}`,
    )
  }
}

export async function resolveAppTargetInstance(
  context: DACPHandlerContext,
  options: ResolveAppTargetInstanceOptions,
): Promise<{ targetInstanceId: string; targetInstanceIsLaunched: boolean }> {
  const { appId, validatedContext, preferredInstanceId, runningListenerInstanceId } = options

  if (preferredInstanceId) {
    const instance = getInstance(context.getState(), preferredInstanceId)
    if (instance) {
      return { targetInstanceId: instance.instanceId, targetInstanceIsLaunched: false }
    }
  }

  if (runningListenerInstanceId) {
    return { targetInstanceId: runningListenerInstanceId, targetInstanceIsLaunched: false }
  }

  if (options.forceLaunch) {
    const targetInstanceId = await launchAppAndWaitForInstance(appId, context, validatedContext)
    return { targetInstanceId, targetInstanceIsLaunched: true }
  }

  const runningInstances = getInstancesByAppId(context.getState(), appId).filter(
    instance =>
      instance.state === AppInstanceState.CONNECTED || instance.state === AppInstanceState.PENDING,
  )
  if (runningInstances.length > 0) {
    const connectedInstances = runningInstances.filter(
      instance => instance.state === AppInstanceState.CONNECTED,
    )
    const candidates = connectedInstances.length > 0 ? connectedInstances : runningInstances
    const targetInstance = candidates.reduce((latest, instance) =>
      instance.lastActivity.getTime() > latest.lastActivity.getTime() ? instance : latest,
    )
    return { targetInstanceId: targetInstance.instanceId, targetInstanceIsLaunched: false }
  }

  const targetInstanceId = await launchAppAndWaitForInstance(appId, context, validatedContext)
  return { targetInstanceId, targetInstanceIsLaunched: true }
}

export function registerPendingIntentState(
  context: DACPHandlerContext,
  options: Omit<PendingIntent, "raisedAt">,
): void {
  context.setState(state => addPendingIntent(state, options))
}

export function schedulePendingIntentDelivery(
  context: DACPHandlerContext,
  requestId: string,
  targetInstanceId: string,
  intentName: string,
  targetInstanceIsLaunched: boolean,
  explicitTargetInstanceId = false,
): void {
  const shouldWaitForListener = shouldWaitForIntentListenerBeforeDelivery(
    context,
    targetInstanceId,
    intentName,
    targetInstanceIsLaunched,
    explicitTargetInstanceId,
  )

  if (shouldWaitForListener) {
    queueIntentDelivery(context, requestId, true)
  } else {
    attemptIntentDelivery(context, requestId, false)
  }
}

export function attachPendingIntentTimeout(context: DACPHandlerContext, requestId: string): void {
  const timeoutHandle = setTimeout(() => {
    releasePendingIntentTimeout(requestId, "raise")
    const pendingIntent = getPendingIntent(context.getState(), requestId)
    if (!pendingIntent) {
      return
    }
    context.setState(state => resolvePendingIntent(state, requestId))
    // Terminal raiseIntentResultResponse so IntentResolution.getResult() settles.
    const response = createDACPErrorResponse(
      { type: "raiseIntentRequest", meta: { requestUuid: requestId } },
      ResultError.ApiTimeout,
      "raiseIntentResultResponse",
    )
    sendDACPResponse({
      response,
      instanceId: pendingIntent.sourceInstanceId,
      responses: context.responses,
    })
  }, context.pendingIntentTimeoutMs)
  registerPendingIntentTimeout(requestId, "raise", timeoutHandle)
}

export function cleanupPendingIntentRequest(requestId: string): void {
  clearPendingIntentTimeouts(requestId)
}

export function mapIntentRaiseErrorToResolveError(error: unknown): ResolveError {
  if (error instanceof NoAppsFoundError) {
    return ResolveError.NoAppsFound
  }
  if (error instanceof TargetAppUnavailableError) {
    return ResolveError.TargetAppUnavailable
  }
  if (error instanceof TargetInstanceUnavailableError) {
    return ResolveError.TargetInstanceUnavailable
  }
  if (error instanceof FDC3ResolveError) {
    return error.errorType
  }

  return ResolveError.IntentDeliveryFailed
}
