import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const packageRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)))
const readmePath = path.join(packageRoot, "README.md")
const readme = readFileSync(readmePath, "utf-8")

/** Symbols that must be imported from `@finos/sail-desktop-agent/browser`. */
const BROWSER_SUBPATH_SYMBOLS = new Set([
  "createBrowserDesktopAgent",
  "createWCPClient",
  "WCPConnector",
  "MessagePortTransport",
])

/** Symbols that must be imported from `@finos/sail-desktop-agent/transports`. */
const TRANSPORTS_SUBPATH_SYMBOLS = new Set([
  "createInMemoryTransportPair",
  "InMemoryTransport",
])

const PACKAGE_NAME = "@finos/sail-desktop-agent"
const LEGACY_PACKAGE_NAME = "@finos/fdc3-sail-desktop-agent"

type ParsedImport = {
  symbols: string[]
  specifier: string
}

function extractCodeBlocks(markdown: string, language: string): string[] {
  const pattern = new RegExp("```" + language + "\\s*\\n([\\s\\S]*?)```", "g")
  const blocks: string[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(markdown)) !== null) {
    blocks.push(match[1])
  }
  return blocks
}

function parseTypeScriptImports(source: string): ParsedImport[] {
  const imports: ParsedImport[] = []
  const importPattern =
    /import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+))\s+from\s+["']([^"']+)["']/g
  let match: RegExpExecArray | null
  while ((match = importPattern.exec(source)) !== null) {
    const named = match[1]
    const defaultImport = match[2]
    const specifier = match[3]
    const symbols = named
      ? named
          .split(",")
          .map(part => part.trim())
          .map(part => part.replace(/^type\s+/, ""))
          .map(part => part.split(/\s+as\s+/)[0].trim())
          .filter(Boolean)
      : defaultImport
        ? [defaultImport]
        : []
    imports.push({ symbols, specifier })
  }
  return imports
}

function collectSailDesktopAgentImports(markdown: string): ParsedImport[] {
  return extractCodeBlocks(markdown, "typescript").flatMap(block =>
    parseTypeScriptImports(block).filter(imp => imp.specifier.startsWith(PACKAGE_NAME)),
  )
}

function extractDirectoryTreeBlock(markdown: string): string {
  const headingIndex = markdown.indexOf("### Directory Structure")
  if (headingIndex === -1) {
    return ""
  }
  const afterHeading = markdown.slice(headingIndex)
  const match = afterHeading.match(/```\s*\n([\s\S]*?)```/)
  return match?.[1] ?? ""
}

function expectedSubpathForSymbol(symbol: string): "" | "/browser" | "/transports" {
  if (BROWSER_SUBPATH_SYMBOLS.has(symbol)) {
    return "/browser"
  }
  if (TRANSPORTS_SUBPATH_SYMBOLS.has(symbol)) {
    return "/transports"
  }
  return ""
}

function subpathFromSpecifier(specifier: string): string {
  if (specifier === PACKAGE_NAME) {
    return ""
  }
  if (specifier.startsWith(`${PACKAGE_NAME}/`)) {
    return specifier.slice(PACKAGE_NAME.length)
  }
  return specifier
}

describe("README.md integrator contract", () => {
  describe("package name and import examples", () => {
    it("does not reference the legacy @finos/fdc3-sail-desktop-agent package name", () => {
      expect(readme).not.toContain(LEGACY_PACKAGE_NAME)
    })

    it("uses @finos/sail-desktop-agent in npm install examples", () => {
      const bashBlocks = extractCodeBlocks(readme, "bash").join("\n")
      expect(bashBlocks).toContain(`npm install ${PACKAGE_NAME}`)
    })

    it("imports documented symbols from the correct package subpaths", () => {
      const violations: string[] = []

      for (const { symbols, specifier } of collectSailDesktopAgentImports(readme)) {
        const actualSubpath = subpathFromSpecifier(specifier)

        if (!specifier.startsWith(PACKAGE_NAME)) {
          continue
        }

        for (const symbol of symbols) {
          const expectedSubpath = expectedSubpathForSymbol(symbol)
          if (actualSubpath !== expectedSubpath) {
            violations.push(
              `${symbol} must import from "${PACKAGE_NAME}${expectedSubpath}" but README has "${specifier}"`,
            )
          }
        }
      }

      expect(violations, violations.join("\n")).toEqual([])
    })

    it("documents at least one browser and one transports subpath import example", () => {
      const specifiers = new Set(
        collectSailDesktopAgentImports(readme).map(imp => subpathFromSpecifier(imp.specifier)),
      )
      expect(specifiers.has("/browser")).toBe(true)
      expect(specifiers.has("/transports")).toBe(true)
      expect(specifiers.has("")).toBe(true)
    })
  })

  describe("injectable validation documentation", () => {
    it("describes DACP validation as injectable via validator or MessageValidator", () => {
      const mentionsInjectableValidation =
        /\binjectable\b/i.test(readme) &&
        (/\bvalidator\b/i.test(readme) || /\bMessageValidator\b/.test(readme))

      expect(
        mentionsInjectableValidation,
        "README should explain injectable validation (e.g. DesktopAgent validator / MessageValidator), not only a Key Features bullet",
      ).toBe(true)
    })

    it("does not claim built-in or shipped Zod validation", () => {
      const builtInZodClaims = [
        /built[- ]in\s+zod/i,
        /shipped\s+zod/i,
        /zod\s+validation(?!\s*\(optional)/i,
        /\bwith\s+TypeScript\s+and\s+Zod\s+validation\b/i,
      ]

      const matches = builtInZodClaims.filter(pattern => pattern.test(readme))
      expect(
        matches,
        "README must not imply Zod validation is built into the package",
      ).toHaveLength(0)
    })

    it("frames optional zod peer dependency as integrator-supplied, not runtime built-in validation", () => {
      const zodPeerLine = readme
        .split("\n")
        .find(line => line.includes("`zod`") && line.includes("-"))

      expect(zodPeerLine, "README should document zod under Peer Dependencies").toBeDefined()

      expect(
        zodPeerLine,
        "zod peer line must not imply the agent ships runtime validation",
      ).not.toMatch(/Runtime validation/i)

      expect(
        zodPeerLine,
        "zod peer line should clarify integrators inject validators (optional peer for Zod-based validators)",
      ).toMatch(/inject|integrator|optional peer/i)
    })
  })

  describe("npm workspace command examples", () => {
    it("uses -w @finos/sail-desktop-agent workspace flag in npm run examples", () => {
      const bashBlocks = extractCodeBlocks(readme, "bash")
      const workspaceCommands = bashBlocks
        .join("\n")
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.startsWith("npm run ") && line.includes("@finos/sail-desktop-agent"))

      expect(workspaceCommands.length).toBeGreaterThan(0)

      const violations = workspaceCommands.filter(
        line => !/-w\s+@finos\/sail-desktop-agent\b/.test(line),
      )

      expect(
        violations,
        `Use "npm run <script> -w @finos/sail-desktop-agent" (found: ${violations.join("; ")})`,
      ).toEqual([])
    })

    it("does not use legacy --workspace= flag for sail-desktop-agent examples", () => {
      const bashBlocks = extractCodeBlocks(readme, "bash").join("\n")
      expect(bashBlocks).not.toMatch(/--workspace=@finos\/sail-desktop-agent/)
    })
  })

  describe("directory structure tree", () => {
    const directoryTree = extractDirectoryTreeBlock(readme)

    it("includes a directory structure section with a file tree", () => {
      expect(directoryTree.length).toBeGreaterThan(0)
      expect(directoryTree).toContain("packages/sail-desktop-agent/")
    })

    const requiredTreeEntries: Array<{ readmeFragment: string; diskPath: string }> = [
      { readmeFragment: "desktop-agent.ts", diskPath: "src/core/desktop-agent.ts" },
      { readmeFragment: "handlers/", diskPath: "src/core/handlers/dacp" },
      { readmeFragment: "dacp/", diskPath: "src/core/handlers/dacp" },
      { readmeFragment: "types.ts", diskPath: "src/core/state/types.ts" },
      { readmeFragment: "initial-state.ts", diskPath: "src/core/state/initial-state.ts" },
      { readmeFragment: "selectors/", diskPath: "src/core/state/selectors" },
      { readmeFragment: "mutators/", diskPath: "src/core/state/mutators" },
      { readmeFragment: "browser-desktop-agent.ts", diskPath: "src/browser/browser-desktop-agent.ts" },
      { readmeFragment: "wcp/", diskPath: "src/browser/wcp" },
      { readmeFragment: "in-memory-transport.ts", diskPath: "src/transports/in-memory-transport.ts" },
    ]

    it.each(requiredTreeEntries)(
      "documents tree entry that exists on disk: $diskPath",
      ({ readmeFragment, diskPath }) => {
        expect(directoryTree).toContain(readmeFragment)
        expect(existsSync(path.join(packageRoot, diskPath))).toBe(true)
      },
    )
  })
})
