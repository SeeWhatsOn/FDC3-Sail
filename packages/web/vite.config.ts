import { defineConfig } from "vite"
import glob from "glob"
import path from "path"
export default defineConfig({
    root: "./html",
    publicDir: "../public",
    server: {
        port: 5173
    },
    resolve: {
        alias: {
            '/src': path.resolve(__dirname, 'src'),
            '/fonts': path.resolve(__dirname, 'public/fonts'),
            '/css': path.resolve(__dirname, 'public/css')
        }
    },
    build: {
        cssMinify: false,   // makes the css easier to read
        sourcemap: true,    // provide souremap for prod debug
        rollupOptions: {
            input: glob.sync("html/**/*.html"),
        },
    },
})
