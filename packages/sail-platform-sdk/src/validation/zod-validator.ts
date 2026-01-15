/**
 * Zod-based Message Validator for DACP Messages
 *
 * This validator uses the auto-generated Zod schemas from the FDC3 specification
 * to validate DACP messages at runtime. It's an optional component that can be
 * injected into the Desktop Agent for strict message validation.
 *
 * @example
 * ```typescript
 * import { createZodValidator } from "@finos/sail-platform-sdk"
 * import { DesktopAgent } from "@finos/fdc3-sail-desktop-agent"
 *
 * const agent = new DesktopAgent({
 *   transport: myTransport,
 *   validator: createZodValidator(),
 * })
 * ```
 */

import type { MessageValidator, ValidationResult } from "@finos/fdc3-sail-desktop-agent"
import {
  BroadcastRequestSchema,
  AddContextListenerRequestSchema,
  RaiseIntentRequestSchema,
  GetCurrentChannelRequestSchema,
  JoinUserChannelRequestSchema,
  GetUserChannelsRequestSchema,
  LeaveCurrentChannelRequestSchema,
  GetOrCreateChannelRequestSchema,
  AddIntentListenerRequestSchema,
  IntentListenerUnsubscribeRequestSchema,
  FindIntentRequestSchema,
  FindIntentsByContextRequestSchema,
  RaiseIntentForContextRequestSchema,
  IntentResultRequestSchema,
  GetInfoRequestSchema,
  OpenRequestSchema,
  FindInstancesRequestSchema,
  GetAppMetadataRequestSchema,
  AddEventListenerRequestSchema,
  EventListenerUnsubscribeRequestSchema,
  CreatePrivateChannelRequestSchema,
  PrivateChannelDisconnectRequestSchema,
  PrivateChannelAddContextListenerRequestSchema,
  WCP4ValidateAppIdentitySchema,
  HeartbeatAcknowledgementRequestSchema,
  ContextListenerUnsubscribeRequestSchema,
  GetCurrentContextRequestSchema,
} from "@finos/fdc3-sail-desktop-agent"
import type { z } from "zod"

type SchemaMap = Record<string, z.ZodSchema>

/**
 * Map of DACP message types to their Zod schemas
 */
const schemaMap: SchemaMap = {
  // Context handlers
  broadcastRequest: BroadcastRequestSchema,
  addContextListenerRequest: AddContextListenerRequestSchema,
  contextListenerUnsubscribeRequest: ContextListenerUnsubscribeRequestSchema,

  // Intent handlers
  raiseIntentRequest: RaiseIntentRequestSchema,
  raiseIntentForContextRequest: RaiseIntentForContextRequestSchema,
  addIntentListenerRequest: AddIntentListenerRequestSchema,
  intentListenerUnsubscribeRequest: IntentListenerUnsubscribeRequestSchema,
  findIntentRequest: FindIntentRequestSchema,
  findIntentsByContextRequest: FindIntentsByContextRequestSchema,
  intentResultRequest: IntentResultRequestSchema,

  // Channel handlers
  getCurrentChannelRequest: GetCurrentChannelRequestSchema,
  getCurrentContextRequest: GetCurrentContextRequestSchema,
  joinUserChannelRequest: JoinUserChannelRequestSchema,
  leaveCurrentChannelRequest: LeaveCurrentChannelRequestSchema,
  getUserChannelsRequest: GetUserChannelsRequestSchema,
  getOrCreateChannelRequest: GetOrCreateChannelRequestSchema,

  // App management handlers
  getInfoRequest: GetInfoRequestSchema,
  openRequest: OpenRequestSchema,
  findInstancesRequest: FindInstancesRequestSchema,
  getAppMetadataRequest: GetAppMetadataRequestSchema,

  // Event handlers
  addEventListenerRequest: AddEventListenerRequestSchema,
  eventListenerUnsubscribeRequest: EventListenerUnsubscribeRequestSchema,

  // Private channel handlers
  createPrivateChannelRequest: CreatePrivateChannelRequestSchema,
  privateChannelDisconnectRequest: PrivateChannelDisconnectRequestSchema,
  privateChannelAddContextListenerRequest: PrivateChannelAddContextListenerRequestSchema,

  // WCP handlers
  WCP4ValidateAppIdentity: WCP4ValidateAppIdentitySchema,

  // Heartbeat handlers
  heartbeatAcknowledgementRequest: HeartbeatAcknowledgementRequestSchema,
}

/**
 * Creates a Zod-based message validator for DACP messages.
 *
 * @param options - Optional configuration
 * @param options.strict - If true, reject unknown message types. Default: false (pass through)
 * @returns A MessageValidator implementation using Zod schemas
 *
 * @example
 * ```typescript
 * // Basic usage
 * const validator = createZodValidator()
 *
 * // Strict mode - reject unknown message types
 * const strictValidator = createZodValidator({ strict: true })
 * ```
 */
export function createZodValidator(options?: { strict?: boolean }): MessageValidator {
  const strict = options?.strict ?? false

  return {
    validate(messageType: string, message: unknown): ValidationResult {
      const schema = schemaMap[messageType]

      if (!schema) {
        // Unknown message type
        if (strict) {
          return {
            valid: false,
            errors: [`Unknown message type: ${messageType}`],
          }
        }
        // Pass through unknown types in non-strict mode
        return { valid: true }
      }

      const result = schema.safeParse(message)

      if (result.success) {
        return { valid: true }
      }

      // Extract error messages from Zod
      const errors = result.error.issues.map(
        (issue: { path: (string | number)[]; message: string }) =>
          `${issue.path.join(".")}: ${issue.message}`
      )

      return {
        valid: false,
        errors,
      }
    },
  }
}

/**
 * Pre-configured Zod validator instance for convenience.
 * Uses non-strict mode (unknown message types pass through).
 */
export const zodValidator: MessageValidator = createZodValidator()

/**
 * Pre-configured strict Zod validator instance.
 * Rejects unknown message types.
 */
export const strictZodValidator: MessageValidator = createZodValidator({ strict: true })
