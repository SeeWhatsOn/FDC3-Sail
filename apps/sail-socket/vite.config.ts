import { defineConfig } from "vite"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    // Allow imports without file extensions
    extensions: ['.ts', '.js', '.json']
  },
  // Ensure proper module resolution for Node.js packages
  ssr: {
    noExternal: ['@finos/fdc3-web-impl']
  },
  build: {
    target: 'node18',
    lib: {
      entry: 'src/main.ts',
      formats: ['es'],
      fileName: 'main'
    },
    rollupOptions: {
      external: ['socket.io', 'dotenv', 'http']
    }
  }
})