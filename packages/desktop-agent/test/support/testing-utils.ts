/**
 * Testing Utilities
 *
 * Replacement for @finos/testing package functions used in step definitions.
 */

import { DataTable, Given, Then, When } from "@cucumber/cucumber"
import { CustomWorld } from "../world"
import expect from "expect"

/**
 * Handle resolution of special values in test data.
 * Resolves {null}, {empty}, etc. to actual values.
 */
export function handleResolve(value: string, world: CustomWorld): any {
  if (!value) return value

  // Handle special markers
  if (value === "{null}") return null
  if (value === "{empty}") return undefined

  // Check if it's a reference to a prop in the world
  if (value.startsWith("{") && value.endsWith("}")) {
    const propName = value.slice(1, -1)
    return world.props[propName]
  }

  return value
}

/**
 * Match data from test against expected values in DataTable.
 * Supports nested property access and special value handling.
 * Uses Jest's expect for powerful assertions and great error messages.
 */
export function matchData(world: CustomWorld, actual: any[], dataTable: DataTable): void {
  const expected = dataTable.hashes()

  // Check length with Jest's built-in matcher
  expect(actual).toHaveLength(expected.length)

  // Check each row
  for (let i = 0; i < expected.length; i++) {
    const expectedRow = expected[i]
    const actualRow = actual[i]

    // Check each column in the row
    for (const [key, expectedValue] of Object.entries(expectedRow)) {
      const resolvedExpected = handleResolve(expectedValue as string, world)

      // Handle nested property access (e.g., "msg.type", "msg.payload.error")
      const actualValue = getNestedProperty(actualRow, key)

      try {
        // Handle pattern matching for "matches_type" fields
        if (key.includes("matches_type") || key.includes("matches_")) {
          // For match fields, just check if it exists/is truthy
          expect(actualValue).toBeTruthy()
        } else if (resolvedExpected === null) {
          expect(actualValue).toBeNull()
        } else if (resolvedExpected === undefined) {
          // {empty} or {undefined} - don't assert specific value
          // This allows optional fields in the verification
        } else {
          expect(actualValue).toEqual(resolvedExpected)
        }
      } catch (error) {
        // Add context to Jest's error message
        const enhancedError = new Error(
          `Row ${i}, field "${key}": ${error instanceof Error ? error.message : String(error)}`
        )
        throw enhancedError
      }
    }
  }
}

/**
 * Get nested property from object using dot notation.
 * E.g., getNestedProperty(obj, "msg.payload.error") returns obj.msg.payload.error
 */
function getNestedProperty(obj: any, path: string): any {
  const parts = path.split(".")
  let current = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }

    // Handle array access like "apps[0]"
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/)
    if (arrayMatch) {
      const [, prop, index] = arrayMatch
      current = current[prop]
      if (Array.isArray(current)) {
        current = current[parseInt(index, 10)]
      } else {
        return undefined
      }
    } else {
      current = current[part]
    }
  }

  return current
}
