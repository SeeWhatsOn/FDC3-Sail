/**
 * Test Setup Configuration
 *
 * Global test setup for the desktop-agent package tests.
 * Configures testing environment and shared utilities.
 */

// Global test configuration
globalThis.console.log = (...args) => {
  // Suppress console.log during tests unless VERBOSE_TESTS is set
  if (process.env.VERBOSE_TESTS) {
    console.info(...args)
  }
}

// Mock Date.now for consistent timestamps in tests
const originalDateNow = Date.now
let mockTime = new Date('2024-01-01T00:00:00Z').getTime()

// Allow tests to control time
globalThis.setMockTime = (time: Date | number) => {
  mockTime = typeof time === 'number' ? time : time.getTime()
}

globalThis.advanceMockTime = (ms: number) => {
  mockTime += ms
}

globalThis.resetMockTime = () => {
  mockTime = new Date('2024-01-01T00:00:00Z').getTime()
}

// Setup complete
console.info('Desktop Agent test setup complete')