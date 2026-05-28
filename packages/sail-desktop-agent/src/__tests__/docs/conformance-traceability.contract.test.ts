/**
 * Contract tests for FDC3 2.2 conformance traceability documentation.
 *
 * RED: fails until packages/sail-desktop-agent/docs/conformance-traceability.md
 * exists with the required table shape and valid feature file references.
 */

import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
const traceabilityDocPath = join(packageRoot, "docs/conformance-traceability.md")

const MIN_CONFORMANCE_AREA_ROWS = 10

const REQUIRED_HEADER_CELLS = [
  "conformance area",
  "feature file + scenario",
  "status",
  "notes",
] as const

const VALID_STATUSES = new Set(["covered", "partial", "missing", "n/a"])

const FEATURE_PATH_PATTERN = /test\/features\/[A-Za-z0-9_./-]+\.feature/g

function parseMarkdownTable(markdown: string): { header: string[]; rows: string[][] } {
  const tableLines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))

  if (tableLines.length < 2) {
    return { header: [], rows: [] }
  }

  const splitRow = (line: string): string[] =>
    line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim())

  const header = splitRow(tableLines[0]!)
  const isSeparator = (line: string) => /^\|[\s:\-|]+\|$/.test(line)
  const rows = tableLines.slice(1).filter((line) => !isSeparator(line)).map(splitRow)

  return { header, rows }
}

function headerMatchesRequired(header: string[]): boolean {
  const normalized = header.map((cell) => cell.toLowerCase())
  return REQUIRED_HEADER_CELLS.every((required) =>
    normalized.some((cell) => cell.includes(required)),
  )
}

function extractFeaturePaths(cell: string): string[] {
  return [...cell.matchAll(FEATURE_PATH_PATTERN)].map((match) => match[0]!)
}

describe("conformance traceability documentation contract", () => {
  it("exists at packages/sail-desktop-agent/docs/conformance-traceability.md", () => {
    expect(
      existsSync(traceabilityDocPath),
      `Expected traceability doc at ${traceabilityDocPath}`,
    ).toBe(true)
  })

  it("contains a markdown table with required columns", () => {
    const markdown = readFileSync(traceabilityDocPath, "utf8")
    const { header } = parseMarkdownTable(markdown)

    expect(
      header.length,
      "Traceability doc must include a markdown table header row",
    ).toBeGreaterThanOrEqual(REQUIRED_HEADER_CELLS.length)
    expect(
      headerMatchesRequired(header),
      `Table header must include: ${REQUIRED_HEADER_CELLS.join(", ")}. Found: ${header.join(" | ")}`,
    ).toBe(true)
  })

  it("maps at least ten FDC3 2.2 conformance areas", () => {
    const markdown = readFileSync(traceabilityDocPath, "utf8")
    const { rows, header } = parseMarkdownTable(markdown)
    const statusIndex = header.findIndex((cell) => cell.toLowerCase().includes("status"))
    const areaIndex = header.findIndex((cell) =>
      cell.toLowerCase().includes("conformance area"),
    )

    expect(statusIndex, "Status column is required").toBeGreaterThanOrEqual(0)
    expect(areaIndex, "Conformance area column is required").toBeGreaterThanOrEqual(0)

    const dataRows = rows.filter((row) => row[areaIndex]?.trim())
    expect(
      dataRows.length,
      `Expected at least ${MIN_CONFORMANCE_AREA_ROWS} conformance area rows`,
    ).toBeGreaterThanOrEqual(MIN_CONFORMANCE_AREA_ROWS)

    for (const row of dataRows) {
      const status = row[statusIndex]?.trim().toLowerCase()
      expect(
        VALID_STATUSES.has(status ?? ""),
        `Invalid status "${row[statusIndex]}" for area "${row[areaIndex]}" — use covered | partial | missing | n/a`,
      ).toBe(true)
    }
  })

  it("references only existing Cucumber feature files on disk", () => {
    const markdown = readFileSync(traceabilityDocPath, "utf8")
    const { rows, header } = parseMarkdownTable(markdown)
    const featureColumnIndex = header.findIndex((cell) =>
      cell.toLowerCase().includes("feature file"),
    )

    expect(featureColumnIndex, "Feature file + scenario column is required").toBeGreaterThanOrEqual(
      0,
    )

    const referencedPaths = new Set<string>()
    for (const row of rows) {
      const cell = row[featureColumnIndex] ?? ""
      for (const featurePath of extractFeaturePaths(cell)) {
        referencedPaths.add(featurePath)
      }
    }

    expect(
      referencedPaths.size,
      "Traceability map must reference at least one test/features/**/*.feature path",
    ).toBeGreaterThan(0)

    const missingOnDisk: string[] = []
    for (const featurePath of referencedPaths) {
      const absolutePath = join(packageRoot, featurePath)
      if (!existsSync(absolutePath)) {
        missingOnDisk.push(featurePath)
      }
    }

    expect(
      missingOnDisk,
      `Referenced feature files must exist under packages/sail-desktop-agent: ${missingOnDisk.join(", ")}`,
    ).toEqual([])
  })
})
