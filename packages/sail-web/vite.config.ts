import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Plugin } from "vite"
import { defineConfig } from "vite"
import { globSync } from "glob"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const desktopAgentEntry = path.resolve(
  packageRoot,
  "../sail-desktop-agent/src/index.ts",
)

const mainHtmlPath = "/html/index.html"

/** Vite only auto-serves index.html from the project root; our MPA entry lives under html/. */
function sailWebRootEntry(): Plugin {
  const rewriteRoot = (url: string | undefined) => {
    if (url === "/" || url === "/index.html") {
      return mainHtmlPath
    }
    return url
  }

  return {
    name: "sail-web-root-entry",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        req.url = rewriteRoot(req.url)
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        req.url = rewriteRoot(req.url)
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [sailWebRootEntry()],
  resolve: {
    alias: {
      "@finos/sail-desktop-agent": desktopAgentEntry,
    },
  },
  server: {
    port: 8090,
  },
  preview: {
    port: 8090,
  },
  build: {
    cssMinify: false,
    sourcemap: true,
    rollupOptions: {
      input: globSync("html/**/*.html"),
    },
  },
})
