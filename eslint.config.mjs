import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import pluginReact from "eslint-plugin-react"
import json from "@eslint/json"
import css from "@eslint/css"
import { defineConfig } from "eslint/config"

export default defineConfig([
  // Global ignores
  {
    ignores: [
      "**/*.js",
      "**/*.mjs",
      "**/dist/",
      "**/node_modules/",
      "**/build/",
      ".vscode/",
      ".git/",
      ".github/",
      ".husky/",
      "**/.prettierrc.json",
      "**/.prettierignore",
      "**/.package-lock.json",
      "**/assets/",

      "**/packages/example-apps/",

      // Keep test files included for type checking
    ],
  },

  // JavaScript/basic files
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  // TypeScript files with strict type checking (merged from slt.mjs)
  {
    files: ["packages/*/src/**/*.{ts,tsx}", "**/*.{ts,mts,cts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked, // Strict type checking from slt.mjs
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Strict TypeScript rules from slt.mjs
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",
    },
  },

  // React configuration
  {
    files: ["**/*.{jsx,tsx}"],
    ...pluginReact.configs.flat.recommended,
    rules: {
      "react/react-in-jsx-scope": "off",
    },
    languageOptions: {
      globals: { ...globals.browser },
    },
    settings: {
      react: {
        version: "detect", // Automatically detect React version
      },
    },
  },

  // JSON files
  {
    files: ["**/*.json"],
    plugins: { json },
    language: "json/json",
    extends: ["json/recommended"],
  },

  // CSS files
  {
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
  },
])
