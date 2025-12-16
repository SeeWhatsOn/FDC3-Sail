import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "path"
import fs from "fs"

// Dynamically discover application entry points under src/apps
const appsDir = resolve(__dirname, "src/apps")
const apps = fs.readdirSync(appsDir).filter(file => {
  const filePath = resolve(appsDir, file)
  return fs.statSync(filePath).isDirectory() && fs.existsSync(resolve(filePath, "index.html"))
})

// Create the Rollup input object for multiple HTML entry points
// Only include directories that have an index.html file
const input = apps.reduce((acc, app) => {
  acc[app] = resolve(__dirname, `src/apps/${app}/index.html`)
  return acc
}, {})

export default defineConfig({
  // Ensure assets are resolved relative to the HTML file
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    // Plugin to ensure build output HTML files are placed correctly in dist/apps/[appname]/index.html
    {
      name: "html-output-control",
      enforce: "post", // Run after other build plugins
      generateBundle(_, bundle) {
        Object.keys(bundle).forEach(key => {
          const chunk = bundle[key]
          // Target HTML assets generated from the entry points
          if (
            chunk.type === "asset" &&
            chunk.fileName.endsWith(".html") &&
            chunk.name &&
            apps.includes(chunk.name) // Ensure it's one of our dynamically found apps
          ) {
            // Rewrite the output path to match the desired /apps/[appname]/ structure
            chunk.fileName = `apps/${chunk.name}/index.html`
          }
        })
      },
    },
    // Plugin to rewrite development server requests from /apps/[appname]/* to /src/apps/[appname]/*
    // This allows using the production-like URL structure (/apps/...) during development
    {
      name: "rewrite-middleware",
      apply: "serve", // Only apply this plugin during development (vite serve)
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url) {
            // Handle /apps/[appname]/* requests - rewrite to /src/apps/[appname]/*
            if (req.url.startsWith("/apps/")) {
              req.url = "/src" + req.url
            }
            // Handle /src/main.tsx and other /src/* requests from app context
            // When accessed from /apps/[appname]/, rewrite to /src/apps/[appname]/src/*
            // BUT exclude /src/components/* which are shared components at root level
            else if (
              req.url.startsWith("/src/") &&
              !req.url.startsWith("/src/apps/") &&
              !req.url.startsWith("/src/components/")
            ) {
              // Check if this is a request from an app context by looking at the referer
              const referer = req.headers.referer || ""
              const appMatch = referer.match(/\/apps\/([^\/\?]+)/)
              if (appMatch) {
                const appName = appMatch[1]
                // Rewrite /src/main.tsx to /src/apps/[appname]/src/main.tsx
                req.url = `/src/apps/${appName}${req.url}`
              }
            }
          }
          next()
        })
      },
    },
    // Plugin to transform HTML and rewrite script paths for apps
    {
      name: "html-transform",
      apply: "serve",
      transformIndexHtml(html, ctx) {
        // Extract app name from the file path
        const appMatch = ctx.filename?.match(/src\/apps\/([^\/]+)\/index\.html/)
        if (appMatch) {
          const appName = appMatch[1]
          // Rewrite /src/main.tsx to ./src/main.tsx (relative path)
          // This ensures Vite resolves it relative to the HTML file location
          return html.replace(/src="\/src\/([^"]+)"/g, `src="./src/$1"`)
        }
        return html
      },
    },
  ],
  server: {
    // Standard dev server settings
    hmr: true,
    watch: {
      usePolling: false,
      // Ensure changes within src/apps trigger HMR
      ignored: ["node_modules/**", "dist/**"],
    },
    open: false,
    port: 3002,
    // Allow serving files from the project root (e.g., accessing assets outside src)
    fs: {
      allow: [".."],
      strict: false, // Less strict file serving checks
    },
  },
  build: {
    // Use the dynamically generated input for Rollup
    rollupOptions: {
      input,
    },
    outDir: "dist",
    // Place built assets (JS, CSS, images) into dist/assets
    assetsDir: "assets",
  },
  // Useful during development to avoid stale dependency caches
  optimizeDeps: {
    force: true,
  },
  // Standard alias for cleaner imports
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
})
