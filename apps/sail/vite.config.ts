import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import dts from "vite-plugin-dts"
import path from "path"

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isLib = mode === "lib"

  return {
    plugins: isLib
      ? [
          react(),
          tailwindcss(),
          dts({
            insertTypesEntry: true,
            exclude: [
              "**/__tests__/**",
              "**/*.test.*",
              "**/*.spec.*",
              "**/components/app-directory/**",
              "**/components/channel-selector/embedded/**",
              "**/hooks/useAppDirectorySocket.ts",
              "**/hooks/useDesktopAgent.ts",
            ],
          }),
        ]
      : [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "../../packages/sail-ui/src"),
        "sail-ui": path.resolve(__dirname, "../../packages/sail-ui/src"),
      },
    },
    server: {
      port: 3000,
      open: true,
    },
    build: isLib
      ? {
          lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            name: "SailApp",
            fileName: "sail-app",
            formats: ["es", "umd"],
          },
          rollupOptions: {
            external: ["react", "react-dom", "dockview-react", "socket.io-client", "zustand"],
            output: {
              globals: {
                react: "React",
                "react-dom": "ReactDOM",
                "dockview-react": "DockviewReact",
                "socket.io-client": "io",
                zustand: "zustand",
              },
            },
          },
          sourcemap: true,
        }
      : {
          outDir: "dist",
          sourcemap: true,
        },
  }
})
