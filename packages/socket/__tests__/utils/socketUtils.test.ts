// packages/socket/__tests__/utils/socketUtils.test.ts
import { describe, it, expect, vi } from "vitest"
import { Socket } from "socket.io"
import {
  safeEmit,
  safeAcknowledgement,
  createErrorResponse,
  createSuccessResponse,
} from "../../src/utils/socketUtils"

describe("Socket Utilities", () => {
  describe("safeEmit", () => {
    it("should safely emit an event", () => {
      const socket = {
        emit: vi.fn(),
        connected: true,
      } as unknown as Socket

      safeEmit(socket, "test-event", { data: "test-data" })

      expect(socket.emit).toHaveBeenCalledWith("test-event", {
        data: "test-data",
      })
    })

    it("should not emit if socket is not connected", () => {
      const socket = {
        emit: vi.fn(),
        connected: false,
      } as unknown as Socket

      safeEmit(socket, "test-event", { data: "test-data" })

      expect(socket.emit).not.toHaveBeenCalled()
    })

    it("should handle errors when emitting", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {})
      const socket = {
        emit: vi.fn().mockImplementation(() => {
          throw new Error("Test error")
        }),
        connected: true,
      } as unknown as Socket

      safeEmit(socket, "test-event", { data: "test-data" })

      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe("safeAcknowledgement", () => {
    it("should call the callback with success data", () => {
      const callback = vi.fn()

      safeAcknowledgement(callback, { data: "success" })

      expect(callback).toHaveBeenCalledWith({ data: "success" }, null)
    })

    it("should call the callback with error data", () => {
      const callback = vi.fn()
      const error = new Error("Test error")

      safeAcknowledgement(callback, null, error)

      expect(callback).toHaveBeenCalledWith(null, { error: "Test error" })
    })

    it("should handle nullish callback", () => {
      // This should not throw an error
      expect(() => {
        safeAcknowledgement(null, { data: "success" })
      }).not.toThrow()
    })
  })

  describe("createErrorResponse", () => {
    it("should create an error response from a string", () => {
      const result = createErrorResponse("Test error")

      expect(result).toEqual({ error: "Test error" })
    })

    it("should create an error response from an Error object", () => {
      const error = new Error("Test error")
      error.stack = "test stack"

      const result = createErrorResponse(error)

      expect(result).toEqual({ error: "Test error", stack: "test stack" })
    })

    it("should create an error response with a code", () => {
      const error = new Error("Test error") as Error & { code?: string }
      error.code = "TEST_CODE"

      const result = createErrorResponse(error)

      expect(result).toEqual({ error: "Test error", code: "TEST_CODE" })
    })
  })

  describe("createSuccessResponse", () => {
    it("should create a success response", () => {
      const result = createSuccessResponse({ data: "test" })

      expect(result).toEqual({ data: "test" })
    })

    it("should create a success response with boolean", () => {
      const result = createSuccessResponse(true)

      expect(result).toEqual(true)
    })
  })
})
