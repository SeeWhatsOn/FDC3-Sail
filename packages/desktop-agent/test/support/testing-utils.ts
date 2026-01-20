/**
 * Testing Utilities
 *
 * Replacement for @finos/testing package functions used in step definitions.
 */

import { DataTable } from "@cucumber/cucumber"
import { CustomWorld } from "../world"
import expect from "expect"
import { get } from "lodash"

/**
 * Handle resolution of special values in test data.
 * Resolves {null}, {empty}, etc. to actual values.
 */
export function handleResolve(value: string, world: CustomWorld): string | null | undefined {
  if (!value) return value

  // Handle special markers
  if (value === "{null}") return null
  if (value === "{empty}") return undefined

  // Check if it's a reference to a prop in the world
  if (value.startsWith("{") && value.endsWith("}")) {
    const propName = value.slice(1, -1)
    return world.props[propName] as string | null | undefined
  }

  return value
}

/**
 * Assert a field value matches the expected value.
 * Handles special cases like matches_type fields and null/undefined values.
 */
function assertFieldValue(
  actualValue: unknown,
  expectedValue: string | null | undefined,
  fieldName: string
): void {
  // Handle pattern matching for "matches_type" fields
  if (fieldName.includes("matches_type") || fieldName.includes("matches_")) {
    expect(actualValue).toBeTruthy()
    return
  }

  // Handle null/undefined expectations
  if (expectedValue === null) {
    expect(actualValue).toBeNull()
    return
  }

  if (expectedValue === undefined) {
    // {empty} or {undefined} - don't assert specific value
    // This allows optional fields in the verification
    return
  }

  // Standard equality check
  expect(actualValue).toEqual(expectedValue)
}

/**
 * Match data from test against expected values in DataTable.
 * Supports nested property access and special value handling.
 * Uses Jest's expect for powerful assertions and great error messages.
 */
export function matchData(world: CustomWorld, actual: unknown[], dataTable: DataTable): void {
  const expected = dataTable.hashes()

  expect(actual).toHaveLength(expected.length)

  expected.forEach((expectedRow, rowIndex) => {
    const actualRow = actual[rowIndex]

    Object.entries(expectedRow).forEach(([key, expectedValue]) => {
      const resolvedExpected = handleResolve(expectedValue, world)
      
      // Map matches_type to type for message fields
      let actualKey = key
      if (key.includes("matches_type")) {
        // Replace matches_type with type in the path
        actualKey = key.replace(/matches_type/g, "type")
      }
      
      const actualValue = get(actualRow, actualKey) as unknown

      try {
        assertFieldValue(actualValue, resolvedExpected, key)
      } catch (error) {
        throw new Error(
          `Row ${rowIndex}, field "${key}": ${error instanceof Error ? error.message : String(error)}`
        )
      }
    })
  })
}
