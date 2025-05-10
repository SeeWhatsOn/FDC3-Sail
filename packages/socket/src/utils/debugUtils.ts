export const DEBUG_MODE = true
let _debugReconnectionNumber = 0 // Internal variable

// Function to get and increment the number
export function getNextDebugReconnectionId(): number {
  return _debugReconnectionNumber++
}
