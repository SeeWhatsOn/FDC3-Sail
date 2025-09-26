import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "sail-ui": path.resolve(__dirname, "../../packages/sail-ui/src"),
    },
    conditions: ["development"],
  },
  server: {
    port: 5173,
    host: true,
    fs: {
      // Allow serving files from workspace packages
      allow: ["../.."],
    },
    // the proxy is used to proxy the socket.io requests to the backend to prevent CORS issues
    proxy: {
      "/socket.io": {
        target: "http://localhost:8090",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    cssMinify: false, // makes the css easier to read
    sourcemap: true, // provide sourcemap for prod debug
    outDir: "dist",
  },
})
