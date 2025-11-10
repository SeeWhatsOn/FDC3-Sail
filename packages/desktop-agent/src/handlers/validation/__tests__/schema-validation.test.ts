import { describe, it, expect } from 'vitest'
import {
  validateDACPMessage,
  safeParseDACPMessage,
  DACPValidationError,
  createDACPSuccessResponse,
  createDACPErrorResponse,
  createDACPEvent,
  isDACPRequest,
  isDACPResponse,
  isDACPEvent,
  isBroadcastRequest,
  isAddContextListenerRequest,
  DACP_ERROR_TYPES,
  DACP_TIMEOUTS
} from '../dacp-validator'
import {
  BaseDACPMessageSchema,
  BroadcastRequestSchema,
  AddContextListenerRequestSchema,
  RaiseIntentRequestSchema,
  ContextSchema
} from '../dacp-schemas'

describe('DACP Schema Validation', () => {
  describe('Base Message Validation', () => {
    it('should validate correct base DACP message', () => {
      const validMessage = {
        type: 'broadcastRequest',
        payload: { channelId: 'channel1', context: { type: 'fdc3.instrument' } },
        meta: {
          requestUuid: '123e4567-e89b-12d3-a456-426614174000',
          timestamp: new Date()
        }
      }

      expect(() =>
        validateDACPMessage(validMessage, BaseDACPMessageSchema)
      ).not.toThrow()
    })

    it('should reject message with missing meta', () => {
      const invalidMessage = {
        type: 'broadcastRequest',
        payload: { channelId: 'channel1' }
        // Missing meta
      }

      expect(() =>
        validateDACPMessage(invalidMessage, BaseDACPMessageSchema)
      ).toThrow(DACPValidationError)
    })

    it('should reject message with invalid timestamp', () => {
      const invalidMessage = {
        type: 'broadcastRequest',
        payload: {},
        meta: {
          requestUuid: '123',
          timestamp: 'invalid-date'
        }
      }

      expect(() =>
        validateDACPMessage(invalidMessage, BaseDACPMessageSchema)
      ).toThrow(DACPValidationError)
    })
  })

  describe('Broadcast Request Validation', () => {
    it('should validate correct broadcast request', () => {
      const validRequest = {
        type: 'broadcastRequest',
        payload: {
          channelId: 'red',
          context: {
            type: 'fdc3.instrument',
            id: { ticker: 'AAPL' },
            name: 'Apple Inc.'
          }
        },
        meta: {
          requestUuid: '123e4567-e89b-12d3-a456-426614174000',
          timestamp: new Date()
        }
      }

      const result = validateDACPMessage(validRequest, BroadcastRequestSchema)
      expect(result.type).toBe('broadcastRequest')
      expect(result.payload.channelId).toBe('red')
      expect(result.payload.context.type).toBe('fdc3.instrument')
    })

    it('should reject broadcast request with missing channelId', () => {
      const invalidRequest = {
        type: 'broadcastRequest',
        payload: {
          // Missing channelId
          context: { type: 'fdc3.instrument' }
        },
        meta: {
          requestUuid: '123',
          timestamp: new Date()
        }
      }

      expect(() =>
        validateDACPMessage(invalidRequest, BroadcastRequestSchema)
      ).toThrow(DACPValidationError)
    })

    it('should reject broadcast request with missing context', () => {
      const invalidRequest = {
        type: 'broadcastRequest',
        payload: {
          channelId: 'red'
          // Missing context
        },
        meta: {
          requestUuid: '123',
          timestamp: new Date()
        }
      }

      expect(() =>
        validateDACPMessage(invalidRequest, BroadcastRequestSchema)
      ).toThrow(DACPValidationError)
    })
  })

  describe('Context Schema Validation', () => {
    it('should validate basic context', () => {
      const validContext = {
        type: 'fdc3.instrument',
        id: { ticker: 'AAPL' },
        name: 'Apple Inc.'
      }

      const result = validateDACPMessage(validContext, ContextSchema)
      expect(result.type).toBe('fdc3.instrument')
      expect(result.id?.ticker).toBe('AAPL')
    })

    it('should allow additional properties in context (passthrough)', () => {
      const contextWithExtra = {
        type: 'fdc3.instrument',
        id: { ticker: 'AAPL' },
        customField: 'custom value',
        nestedData: { some: 'data' }
      }

      expect(() =>
        validateDACPMessage(contextWithExtra, ContextSchema)
      ).not.toThrow()
    })

    it('should require type field in context', () => {
      const invalidContext = {
        // Missing type
        id: { ticker: 'AAPL' }
      }

      expect(() =>
        validateDACPMessage(invalidContext, ContextSchema)
      ).toThrow(DACPValidationError)
    })
  })

  describe('Add Context Listener Request Validation', () => {
    it('should validate listener request with channelId', () => {
      const validRequest = {
        type: 'addContextListenerRequest',
        payload: {
          channelId: 'red',
          contextType: 'fdc3.instrument'
        },
        meta: {
          requestUuid: '123',
          timestamp: new Date()
        }
      }

      expect(() =>
        validateDACPMessage(validRequest, AddContextListenerRequestSchema)
      ).not.toThrow()
    })

    it('should validate listener request without optional fields', () => {
      const validRequest = {
        type: 'addContextListenerRequest',
        payload: {},
        meta: {
          requestUuid: '123',
          timestamp: new Date()
        }
      }

      expect(() =>
        validateDACPMessage(validRequest, AddContextListenerRequestSchema)
      ).not.toThrow()
    })
  })

  describe('Raise Intent Request Validation', () => {
    it('should validate intent request', () => {
      const validRequest = {
        type: 'raiseIntentRequest',
        payload: {
          intent: 'ViewChart',
          context: { type: 'fdc3.instrument', id: { ticker: 'AAPL' } },
          app: 'ChartApp'
        },
        meta: {
          requestUuid: '123',
          timestamp: new Date()
        }
      }

      expect(() =>
        validateDACPMessage(validRequest, RaiseIntentRequestSchema)
      ).not.toThrow()
    })

    it('should reject intent request without intent', () => {
      const invalidRequest = {
        type: 'raiseIntentRequest',
        payload: {
          // Missing intent
          context: { type: 'fdc3.instrument' }
        },
        meta: {
          requestUuid: '123',
          timestamp: new Date()
        }
      }

      expect(() =>
        validateDACPMessage(invalidRequest, RaiseIntentRequestSchema)
      ).toThrow(DACPValidationError)
    })
  })
})

describe('Safe Parsing', () => {
  it('should return success for valid message', () => {
    const validMessage = {
      type: 'broadcastRequest',
      payload: {
        channelId: 'red',
        context: { type: 'fdc3.instrument' }
      },
      meta: {
        requestUuid: '123',
        timestamp: new Date()
      }
    }

    const result = safeParseDACPMessage(validMessage, BroadcastRequestSchema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe('broadcastRequest')
    }
  })

  it('should return error for invalid message', () => {
    const invalidMessage = {
      type: 'broadcastRequest',
      payload: {
        // Missing channelId
        context: { type: 'fdc3.instrument' }
      }
    }

    const result = safeParseDACPMessage(invalidMessage, BroadcastRequestSchema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeInstanceOf(DACPValidationError)
    }
  })
})

describe('Message Type Guards', () => {
  const sampleRequest = {
    type: 'broadcastRequest',
    payload: { channelId: 'red', context: { type: 'fdc3.instrument' } },
    meta: { requestUuid: '123', timestamp: new Date() }
  }

  const sampleResponse = {
    type: 'broadcastResponse',
    payload: {},
    meta: { responseUuid: '456', requestUuid: '123', timestamp: new Date() }
  }

  const sampleEvent = {
    type: 'contextEvent',
    payload: { context: { type: 'fdc3.instrument' } },
    meta: { eventUuid: '789', timestamp: new Date() }
  }

  it('should identify DACP requests', () => {
    expect(isDACPRequest(sampleRequest)).toBe(true)
    expect(isDACPRequest(sampleResponse)).toBe(false)
    expect(isDACPRequest(sampleEvent)).toBe(false)
  })

  it('should identify DACP responses', () => {
    expect(isDACPResponse(sampleResponse)).toBe(true)
    expect(isDACPResponse(sampleRequest)).toBe(false)
    expect(isDACPResponse(sampleEvent)).toBe(false)
  })

  it('should identify DACP events', () => {
    expect(isDACPEvent(sampleEvent)).toBe(true)
    expect(isDACPEvent(sampleRequest)).toBe(false)
    expect(isDACPEvent(sampleResponse)).toBe(false)
  })

  it('should identify specific message types', () => {
    expect(isBroadcastRequest(sampleRequest)).toBe(true)
    expect(isBroadcastRequest(sampleResponse)).toBe(false)

    const addListenerRequest = {
      type: 'addContextListenerRequest',
      payload: {},
      meta: { requestUuid: '123', timestamp: new Date() }
    }
    expect(isAddContextListenerRequest(addListenerRequest)).toBe(true)
    expect(isAddContextListenerRequest(sampleRequest)).toBe(false)
  })
})

describe('Response and Event Creators', () => {
  const originalRequest = {
    meta: { requestUuid: '123e4567-e89b-12d3-a456-426614174000' }
  }

  it('should create success response', () => {
    const response = createDACPSuccessResponse(
      originalRequest,
      'broadcastResponse',
      { success: true }
    )

    expect(response.type).toBe('broadcastResponse')
    expect(response.payload.success).toBe(true)
    expect(response.meta.requestUuid).toBe(originalRequest.meta.requestUuid)
    expect(response.meta.responseUuid).toBeDefined()
    expect(response.meta.timestamp).toBeInstanceOf(Date)
  })

  it('should create error response', () => {
    const errorResponse = createDACPErrorResponse(
      originalRequest,
      DACP_ERROR_TYPES.BROADCAST_ERROR,
      'broadcastResponse',
      'Channel not found'
    )

    expect(errorResponse.type).toBe('broadcastResponse')
    expect(errorResponse.payload.error).toBe(DACP_ERROR_TYPES.BROADCAST_ERROR)
    expect(errorResponse.payload.message).toBe('Channel not found')
    expect(errorResponse.meta.requestUuid).toBe(originalRequest.meta.requestUuid)
  })

  it('should create event message', () => {
    const event = createDACPEvent('contextEvent', {
      context: { type: 'fdc3.instrument', id: { ticker: 'AAPL' } }
    })

    expect(event.type).toBe('contextEvent')
    expect((event.payload as any).context.type).toBe('fdc3.instrument')
    expect(event.meta.eventUuid).toBeDefined()
    expect(event.meta.timestamp).toBeInstanceOf(Date)
  })
})

describe('Constants and Error Types', () => {
  it('should have correct DACP timeout values', () => {
    expect(DACP_TIMEOUTS.DEFAULT).toBe(10000) // 10 seconds
    expect(DACP_TIMEOUTS.APP_LAUNCH).toBe(100000) // 100 seconds
    expect(DACP_TIMEOUTS.MINIMUM_APP_LAUNCH).toBe(15000) // 15 seconds
  })

  it('should have standard DACP error types', () => {
    expect(DACP_ERROR_TYPES.APP_TIMEOUT).toBe('AppTimeout')
    expect(DACP_ERROR_TYPES.INTENT_DELIVERY_FAILED).toBe('IntentDeliveryFailed')
    expect(DACP_ERROR_TYPES.NO_APPS_FOUND).toBe('NoAppsFound')
    expect(DACP_ERROR_TYPES.BROADCAST_ERROR).toBe('BroadcastError')
  })
})