/**
 * Runs nyc+cucumber with the Windows module-path fix preloaded into this
 * process and any child processes (via NODE_OPTIONS).
 */
const path = require("path")
const { spawnSync } = require("child_process")

const fix = path.resolve(__dirname, "fix-win-module-paths.cjs")
const existing = process.env.NODE_OPTIONS || ""
process.env.NODE_OPTIONS = `${existing} --require ${JSON.stringify(fix)}`.trim()

require(fix)

const nyc = require.resolve("nyc/bin/nyc.js")
const cucumber = path.join(
  path.dirname(require.resolve("@cucumber/cucumber/package.json")),
  "bin/cucumber.js",
)
const result = spawnSync(
  process.execPath,
  [nyc, "--reporter=lcov", "--reporter=text", "--reporter=json", cucumber],
  { stdio: "inherit", env: process.env, shell: false },
)

process.exit(result.status ?? 1)
