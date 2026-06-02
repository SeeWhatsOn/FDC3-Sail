/**
 * Documentation contract: consume-sail-desktop-agent skill aligns with the
 * post PKG-01–PKG-06 package API (top-level imports, presets, manual composition).
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url))
const skillPath = join(repoRoot, ".cursor/skills/consume-sail-desktop-agent/SKILL.md")

function readSkill(): string {
  return readFileSync(skillPath, "utf-8")
}

/** TypeScript fenced blocks that mention createBrowserDesktopAgent (preset examples). */
function presetExampleBlocks(skill: string): string[] {
  return [...skill.matchAll(/```typescript\n([\s\S]*?)```/g)]
    .map((match) => match[1] ?? "")
    .filter((block) => block.includes("createBrowserDesktopAgent"))
}

describe("consume-sail-desktop-agent skill alignment", () => {
  const skill = readSkill()

  it("documents top-level @finos/sail-desktop-agent as the primary import surface", () => {
    expect(
      skill,
      "skill should import createBrowserDesktopAgent from the top-level package entry"
    ).toMatch(
      /import[\s\S]*createBrowserDesktopAgent[\s\S]*from\s+["']@finos\/sail-desktop-agent["']/
    )

    expect(skill, "skill should name the top-level entry as primary").toMatch(
      /Primary[\s\S]*@finos\/sail-desktop-agent/i
    )
  })

  it("documents host contracts and DEFAULT_FDC3_USER_CHANNELS from the top level", () => {
    expect(skill).toMatch(/\bAppLauncher\b/)
    expect(skill).toMatch(/\bIntentResolver\b/)
    expect(skill).toMatch(/\bChannelControl\b/)
    expect(skill).toMatch(/\bDEFAULT_FDC3_USER_CHANNELS\b/)
  })

  it("distinguishes manual composition from presets", () => {
    expect(skill, "skill should describe manual composition").toMatch(/manual composition/i)
    expect(skill, "skill should describe presets").toMatch(/\bpresets?\b/i)

    expect(
      skill,
      "skill should explain when to use manual composition vs presets"
    ).toMatch(
      /manual composition.{0,600}presets?|presets?.{0,600}manual composition/is
    )
  })

  it("documents preset options appLauncher, intentResolver, apps, and userChannels", () => {
    expect(skill).toMatch(/createBrowserDesktopAgent\s*\(\s*\{[\s\S]*appLauncher/is)
    expect(skill).toMatch(/createBrowserDesktopAgent\s*\(\s*\{[\s\S]*intentResolver/is)
    expect(skill).toMatch(/createBrowserDesktopAgent\s*\(\s*\{[\s\S]*apps/is)
    expect(skill).toMatch(/createBrowserDesktopAgent\s*\(\s*\{[\s\S]*userChannels/is)
  })

  it("documents apps seeding without requiring appDirectories URLs", () => {
    expect(skill, "skill should explain apps seeds directory in-memory").toMatch(
      /apps[\s\S]{0,200}(seed|without|no HTTP|in-memory)/i
    )
  })

  it("documents intentResolver on preset replacing manual intentResolverNeeded wiring", () => {
    expect(skill).toMatch(/intentResolverNeeded/i)
    expect(skill, "skill should prefer preset intentResolver over manual WCP events").toMatch(
      /intentResolver[\s\S]{0,400}(intentResolverNeeded|do not need manual)/i
    )
  })

  it("treats /browser and /transports as advanced subpaths, not the primary surface", () => {
    expect(skill, "skill should label /browser as advanced").toMatch(
      /Advanced[\s\S]*@finos\/sail-desktop-agent\/browser/i
    )
    expect(skill, "skill should label /transports as advanced").toMatch(
      /Advanced[\s\S]*@finos\/sail-desktop-agent\/transports/i
    )
    expect(skill, "skill should warn against /browser as default createBrowserDesktopAgent path").toMatch(
      /Do not[\s\S]*createBrowserDesktopAgent[\s\S]*\/browser/i
    )
  })

  it("does not teach /browser as the primary import path for createBrowserDesktopAgent", () => {
    const blocks = presetExampleBlocks(skill)

    expect(
      blocks.length,
      "skill should include at least one createBrowserDesktopAgent preset example"
    ).toBeGreaterThan(0)

    for (const block of blocks) {
      expect(
        block,
        "preset examples should import createBrowserDesktopAgent from top level, not /browser"
      ).toMatch(/from\s+["']@finos\/sail-desktop-agent["']/)
      expect(
        block,
        "preset examples must not import createBrowserDesktopAgent from /browser"
      ).not.toMatch(/from\s+["']@finos\/sail-desktop-agent\/browser["']/)
    }
  })
})
