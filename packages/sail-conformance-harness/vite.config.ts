import { defineConfig, lazyPlugins } from "vite-plus"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: lazyPlugins(() => [react()]),
  optimizeDeps: {
    exclude: ["@finos/sail-desktop-agent"],
  },
  server: {
    port: 3001,
    open: true,
    proxy: {
      // Local profile: conformance pages load under /apps; scripts/CSS use /lib.
      "/apps": {
        target: "https://fdc3.finos.org/toolbox/fdc3-conformance",
        changeOrigin: true,
        secure: true,
      },
      "/lib": {
        target: "https://fdc3.finos.org/toolbox/fdc3-conformance",
        changeOrigin: true,
        secure: true,
      },
      "/screenshots": {
        target: "https://fdc3.finos.org/toolbox/fdc3-conformance",
        changeOrigin: true,
        secure: true,
      },
      "/finos-icon-256.png": {
        target: "https://fdc3.finos.org/toolbox/fdc3-conformance",
        changeOrigin: true,
        secure: true,
      },
    },
    // Reload when @finos/sail-desktop-agent dist changes (package resolves to dist/, not src/)
    watch: {
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "!**/node_modules/@finos/sail-desktop-agent/**",
      ],
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
})
