import { vi } from "vitest"

// Common mock for GridStack to avoid repetition
export const mockGridStack = () => {
  return vi.fn(() => ({
    addWidget: vi.fn(),
    removeWidget: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
  }))
}

// Mock types for testing
export type MockSocket = {
  emit: ReturnType<typeof vi.fn>
  connected: boolean
}

export const createMockSocket = (): MockSocket => ({
  emit: vi.fn(),
  connected: true,
})
