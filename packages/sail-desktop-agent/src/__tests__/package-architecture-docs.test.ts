/**
 * Documentation contract: @finos/sail-desktop-agent package boundary, target tree,
 * public API modes (manual composition vs presets), and @finos/sail-platform-api
 * wrapper responsibility for layout/workspace/storage/config.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const packageRoot = fileURLToPath(new URL("../..", import.meta.url))
const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url))
const srcRoot = join(packageRoot, "src")

/** Intended top-level folders under packages/sail-desktop-agent/src. */
const TARGET_SRC_FOLDERS = [
  "core",
  "host-contracts",
  "protocols",
  "transports",
  "connectors",
  "presets",
] as const

/** Platform concerns that belong in @finos/sail-platform-api, not core desktop-agent. */
const PLATFORM_API_CONCERNS = ["layout", "workspace", "storage", "config"] as const

function readPackageFile(relativePath: string): string {
  return readFileSync(join(packageRoot, relativePath), "utf-8")
}

function readWebsiteDoc(relativePath: string): string {
  return readFileSync(join(repoRoot, "website/docs/architecture", relativePath), "utf-8")
}

const architectureDocs = {
  readme: {
    label: "packages/sail-desktop-agent/README.md",
    content: readPackageFile("README.md"),
  },
  overview: {
    label: "website/docs/architecture/overview.md",
    content: readWebsiteDoc("overview.md"),
  },
  sailPlatformSdk: {
    label: "website/docs/architecture/sail-platform-sdk.md",
    content: readWebsiteDoc("sail-platform-sdk.md"),
  },
} as const

const combinedArchitectureDocs = Object.values(architectureDocs)
  .map((doc) => doc.content)
  .join("\n\n")

function folderMentionPattern(folder: string): RegExp {
  return new RegExp(`(?:src/)?${folder.replace("-", "\\-")}\\b`, "i")
}

function concernRoutedToPlatformApi(content: string, concern: string): boolean {
  const platformApiMention = /@finos\/sail-platform-api|sail-platform-api/i.test(content)
  const concernMention = new RegExp(concern, "i").test(content)
  const routesAwayFromCore =
    /platform-api|platform services|sail platform/i.test(content) &&
    /not.*desktop-agent|instead of.*desktop-agent|routes?.*platform|belongs? in.*platform/i.test(
      content
    )

  return platformApiMention && concernMention && routesAwayFromCore
}

describe("@finos/sail-desktop-agent package architecture documentation", () => {
  describe("target src tree (core, host-contracts, protocols, transports, connectors, presets)", () => {
    it.each(TARGET_SRC_FOLDERS)(
      "documents the intended src/%s folder across architecture docs",
      (folder) => {
        for (const doc of Object.values(architectureDocs)) {
          expect(
            doc.content,
            `${doc.label} should document packages/sail-desktop-agent/src/${folder}`
          ).toMatch(folderMentionPattern(folder))
        }
      }
    )

    it("README.md directory structure section lists all intended top-level src folders", () => {
      const readme = architectureDocs.readme.content
      const directoryStructureSection = readme.slice(
        readme.indexOf("### Directory Structure"),
        readme.indexOf("## Installation")
      )

      expect(
        directoryStructureSection,
        "README should contain a Directory Structure section under Architecture"
      ).toContain("### Directory Structure")

      for (const folder of TARGET_SRC_FOLDERS) {
        expect(
          directoryStructureSection,
          `README Directory Structure should list src/${folder}`
        ).toMatch(folderMentionPattern(folder))
      }
    })

    it("src tree on disk matches documented top-level folders", () => {
      const actualFolders = readdirSync(srcRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("__"))
        .map((entry) => entry.name)
        .sort()

      expect(actualFolders, "src/ should expose the documented package boundary folders").toEqual(
        [...TARGET_SRC_FOLDERS].sort()
      )
    })
  })

  describe("public API modes: manual composition primitives vs presets", () => {
    it("architecture docs distinguish manual composition from high-level presets", () => {
      expect(
        combinedArchitectureDocs,
        "docs should describe manual composition (or composition primitives) for custom agents"
      ).toMatch(/manual composition|composition primitives?/i)

      expect(
        combinedArchitectureDocs,
        "docs should describe high-level presets for faster integration"
      ).toMatch(/\bpresets?\b/i)

      expect(
        combinedArchitectureDocs,
        "docs should explain when to use manual composition vs presets"
      ).toMatch(
        /manual composition.{0,400}presets?|presets?.{0,400}manual composition|composition primitives?.{0,400}presets?|presets?.{0,400}composition primitives?/is
      )
    })

    it("README.md documents both manual composition entry points and preset factories", () => {
      const readme = architectureDocs.readme.content

      expect(readme, "README should document manual composition primitives").toMatch(
        /manual composition|composition primitives?/i
      )
      expect(readme, "README should document preset factories or high-level presets").toMatch(
        /\bpresets?\b/i
      )
    })
  })

  describe("@finos/sail-platform-api wrapper responsibility", () => {
    it.each(PLATFORM_API_CONCERNS)(
      "routes %s concerns to @finos/sail-platform-api instead of core desktop-agent",
      (concern) => {
        expect(
          concernRoutedToPlatformApi(combinedArchitectureDocs, concern),
          `architecture docs should route ${concern} to @finos/sail-platform-api, not @finos/sail-desktop-agent core`
        ).toBe(true)
      }
    )

    it("sail-platform-sdk architecture doc names layout, workspace, storage, and config as platform features", () => {
      const doc = architectureDocs.sailPlatformSdk.content

      for (const concern of PLATFORM_API_CONCERNS) {
        expect(doc, `sail-platform-sdk.md should mention ${concern}`).toMatch(
          new RegExp(concern, "i")
        )
      }

      expect(doc, "sail-platform-sdk.md should identify @finos/sail-platform-api as owner").toMatch(
        /@finos\/sail-platform-api|packages\/sail-platform-api/i
      )
    })
  })

  describe("public package exports align with documented entrypoints", () => {
    it("package.json exports include documented submodule entrypoints for presets", () => {
      const pkg = JSON.parse(readPackageFile("package.json")) as {
        exports?: Record<string, unknown>
      }

      expect(pkg.exports, "package.json exports should expose a presets entrypoint").toHaveProperty(
        "./presets"
      )
    })

    it("documented submodule folders exist under src/", () => {
      for (const folder of ["presets", "connectors", "host-contracts", "protocols"] as const) {
        const folderPath = join(srcRoot, folder)
        expect(
          existsSync(folderPath),
          `src/${folder} should exist when architecture docs describe it as a package boundary folder`
        ).toBe(true)
      }
    })
  })
})
