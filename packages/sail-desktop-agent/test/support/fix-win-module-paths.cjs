/**
 * On Windows, Node's require cache is case-sensitive while the filesystem is not.
 * Cucumber's CLI and tsx-loaded step files can resolve the same file as
 * `c:\...` and `C:\...`, creating two SupportCodeLibraryBuilder singletons.
 * The CLI resets one; step defs call Given on the other → "isn't running".
 *
 * Force a canonical drive-letter casing and alias require.cache entries.
 */
const Module = require("module")

function canonicalize(filename) {
  if (typeof filename !== "string") return filename
  if (/^[a-zA-Z]:/.test(filename)) {
    return filename.charAt(0).toUpperCase() + filename.slice(1)
  }
  return filename
}

if (process.platform === "win32") {
  const origResolve = Module._resolveFilename
  Module._resolveFilename = function (request, parent, isMain, options) {
    return canonicalize(
      origResolve.call(this, request, parent, isMain, options),
    )
  }

  const origLoad = Module._load
  Module._load = function (request, parent, isMain) {
    const result = origLoad.apply(this, arguments)
    // If both casings somehow got cached, point the lowercase key at the
    // canonical module so subsequent requires share the singleton.
    try {
      const resolved = Module._resolveFilename(request, parent, isMain)
      const alt =
        typeof resolved === "string" && /^[A-Z]:/.test(resolved)
          ? resolved.charAt(0).toLowerCase() + resolved.slice(1)
          : null
      if (alt && require.cache[resolved] && !require.cache[alt]) {
        require.cache[alt] = require.cache[resolved]
      }
      if (
        alt &&
        require.cache[alt] &&
        require.cache[resolved] &&
        require.cache[alt] !== require.cache[resolved]
      ) {
        require.cache[alt] = require.cache[resolved]
      }
    } catch {
      // ignore unresolved requests
    }
    return result
  }
}
