import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const packageRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)))
const readmePath = path.join(packageRoot, "README.md")
const readme = readFileSync(readmePath, "utf-8")

const desktopAgentSource = readFileSync(
  path.join(packageRoot, "src/core/desktop-agent.ts"),
  "utf-8"
)
const loggerSource = readFileSync(
  path.join(packageRoot, "src/core/interfaces/logger.ts"),
  "utf-8"
)
const browserFactorySource = readFileSync(
  path.join(packageRoot, "src/browser/browser-desktop-agent.ts"),
  "utf-8"
)

describe("logging documentation contract", () => {
  it("documents logger and logPayloadDetail in README Logging subsection", () => {
    expect(readme).toMatch(/## Logging|### Logging/)
    expect(readme).toContain("logPayloadDetail")
    expect(readme).toContain("metadata")
    expect(readme).toContain("injectable")
  })

  it("documents logPayloadDetail on DesktopAgentConfig with @defaultValue metadata", () => {
    expect(desktopAgentSource).toContain("logPayloadDetail")
    expect(desktopAgentSource).toMatch(/@defaultValue\s+['"]metadata['"]/)
  })

  it("documents how Logger debug interacts with logPayloadDetail", () => {
    expect(loggerSource).toMatch(/@remarks/)
    expect(loggerSource).toContain("logPayloadDetail")
  })

  it("documents logPayloadDetail on createBrowserDesktopAgent options", () => {
    expect(browserFactorySource).toContain("logPayloadDetail")
  })
})
