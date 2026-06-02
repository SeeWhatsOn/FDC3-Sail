import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@finos/sail-desktop-agent"],
  },
  server: {
    port: 3001,
    open: true,
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
