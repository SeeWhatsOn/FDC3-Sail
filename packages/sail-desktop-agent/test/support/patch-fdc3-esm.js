/**
 * Published @finos/fdc3-* packages ship ESM without `.js` extensions.
 * Node's sync ESM loader (used by cucumber/tsx) cannot resolve those.
 * This rewrites relative bare imports in those packages' dist files.
 */
const fs = require("fs")
const path = require("path")

const roots = [
  path.join(__dirname, "..", "..", "node_modules", "@finos"),
  path.join(__dirname, "..", "..", "..", "..", "node_modules", "@finos"),
]

const importRe =
  /(from\s+|import\s*\(|export\s+\*\s+from\s+)(['"])(\.[^'"]+?)(\2)/g

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith(".js")) out.push(full)
  }
  return out
}

let changed = 0
for (const root of roots) {
  if (!fs.existsSync(root)) continue
  for (const pkg of fs.readdirSync(root)) {
    if (!pkg.startsWith("fdc3")) continue
    const files = walk(path.join(root, pkg))
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8")
      const next = src.replace(importRe, (match, prefix, quote, spec, q2) => {
        if (
          spec.endsWith(".js") ||
          spec.endsWith(".json") ||
          spec.endsWith(".node") ||
          spec.endsWith("/")
        ) {
          return match
        }
        return `${prefix}${quote}${spec}.js${q2}`
      })
      if (next !== src) {
        fs.writeFileSync(file, next)
        changed++
      }
    }
  }
}

console.log(`Patched ${changed} @finos/fdc3* ESM files for Node resolution`)
