import "@testing-library/jest-dom"

// Mock CSS modules
import { vi } from "vitest"

vi.mock("*.module.css", () => ({
  default: new Proxy({}, {
    get: (target, prop) => prop
  })
}))

// Simple setup for component tests
// Server integration will be added in Phase 2
