import { defineConfig } from "vite"
import path from "path"

export default defineConfig({
  root: "html",
  publicDir: "../public",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../src"),
    },
  },
  server: {
    port: 5173,
    host: true,
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
    rollupOptions: {
      input: {
        main: "index.html",
        embed: "embed.html",
      },
    },
  },
})
