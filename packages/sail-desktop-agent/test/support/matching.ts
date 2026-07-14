import expect from "expect"
import { CustomWorld } from "../world"

export interface HashesProvider {
  hashes(): Record<string, string>[]
}

function getByPath(obj: unknown, path: string): unknown {
  const keys = path.replace(/\[(\d+)\]/g, ".$1").split(".")
  let current: unknown = obj
  for (const key of keys) {
    if (current == null || typeof current !== "object") {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function isNumeric(n: string) {
  return !isNaN(parseFloat(n)) && isFinite(n as unknown as number)
}

/**
 * Resolves Gherkin placeholders of the form `{path}` against `world.props`.
 * Plain strings are returned unchanged. Special literals: `{null}`, `{true}`,
 * `{false}`, and numeric `{123}`.
 *
 * Local stand-in for the unpublished `@finos/testing` helper from the FDC3 monorepo.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handleResolve(name: string, on: CustomWorld): any {
  if (name.startsWith("{") && name.endsWith("}")) {
    const stripped = name.substring(1, name.length - 1)
    if (stripped == "null") {
      return null
    } else if (stripped == "true") {
      return true
    } else if (stripped == "false") {
      return false
    } else if (isNumeric(stripped)) {
      return Number.parseFloat(stripped)
    } else {
      return getByPath(on.props, stripped)
    }
  } else {
    return name
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function doesRowMatch(
  cw: CustomWorld,
  t: Record<string, string>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
): boolean {
  for (const [field, actual] of Object.entries(t)) {
    if (field.endsWith("matches_type")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let valdata: any = data

      if (field.length > "matches_type".length) {
        const path = field.substring(
          0,
          field.length - "matches_type".length - 1,
        )
        valdata = getByPath(data, path)
      }

      const validator = cw.props["ajv"]
      const validate = validator.getSchema(
        "https://fdc3.finos.org/schemas/next/api/" + actual + ".schema.json",
      )
      if (validate == undefined) {
        throw Error("No schema found for " + actual)
      }
      const valid = validate(valdata)
      if (!valid) {
        try {
          cw.log(
            `Comparing Validation failed: ${JSON.stringify(data, null, 2)} \n ${JSON.stringify(validate.errors)}`,
          )
        } catch {
          cw.log(
            `Comparing Validation failed: ${JSON.stringify(validate.errors)}`,
          )
        }
        return false
      }
    } else {
      const found = getByPath(data, field)
      const resolved = handleResolve(actual, cw)

      if (found != resolved) {
        try {
          cw.log(
            `Comparing Validation failed: ${JSON.stringify(data, null, 2)} \n Match failed on ${field} '${found}' vs '${resolved}'`,
          )
        } catch {
          cw.log(
            "Match failed on " +
              field +
              " '" +
              found +
              "' vs '" +
              resolved +
              "'",
          )
        }
        return false
      }
    }
  }

  return true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function matchData(
  cw: CustomWorld,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actual: any[],
  dt: HashesProvider,
) {
  const tableData = dt.hashes()
  const rowCount = tableData.length

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let resultCopy = JSON.parse(JSON.stringify(actual)) as any[]
  cw.log(
    `result ${JSON.stringify(resultCopy, null, 2)} length ${resultCopy.length}`,
  )
  expect(resultCopy).toHaveLength(rowCount)
  let row = 0

  resultCopy = resultCopy.filter((rr) => {
    const matchingRow = tableData[row]
    row++
    if (doesRowMatch(cw, matchingRow, rr)) {
      return false
    } else {
      cw.log(`Couldn't match row: ${JSON.stringify(rr, null, 2)}`)
      return true
    }
  })

  expect(resultCopy).toHaveLength(0)
}
