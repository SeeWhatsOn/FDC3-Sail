import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import pluginReact from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import importPlugin from "eslint-plugin-import"
import json from "@eslint/json"
import css from "@eslint/css"
import prettier from "eslint-config-prettier"
// import tailwind from "eslint-plugin-tailwindcss"
import { defineConfig } from "eslint/config"

export default defineConfig([
  // Global ignores
  {
    ignores: [
      "**/dist/",
      "**/node_modules/",
      "**/build/",
      ".vscode/",
      ".git/",
      ".github/",
      ".husky/",
      "**/.prettierrc.json",
      "**/.prettierignore",
      "**/package-lock.json",
      "**/yarn.lock",
      "**/pnpm-lock.yaml",
      "**/assets/",

      // TODO: remove this at a later date
      "**/apps/example-fdc3-apps/",

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

  // Build config files (no project service needed)
  {
    files: [
      "**/vite.config.{ts,mts,cts}",
      "**/vitest.config.{ts,mts,cts}",
      "**/rollup.config.{ts,mts,cts}",
      "**/webpack.config.{ts,mts,cts}",
      "**/esbuild.config.{ts,mts,cts}",
    ],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  },

  // TypeScript files with strict type checking (merged from slt.mjs)
  {
    files: ["packages/*/src/**/*.{ts,tsx}", "apps/*/src/**/*.{ts,tsx}", "**/*.{ts,mts,cts,tsx}"],
    ignores: [
      "**/vite.config.{ts,mts,cts}",
      "**/vitest.config.{ts,mts,cts}",
      "**/rollup.config.{ts,mts,cts}",
      "**/webpack.config.{ts,mts,cts}",
      "**/esbuild.config.{ts,mts,cts}",
    ], // Exclude build config files from project service
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
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
    },
  },

  // React configuration with hooks
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: {
      react: pluginReact,
      "react-hooks": reactHooks,
      import: importPlugin,
    },
    rules: {
      ...pluginReact.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
        },
      ],
    },
    languageOptions: {
      globals: { ...globals.browser },
    },
    settings: {
      react: {
        version: "detect", // Automatically detect React version
      },
      "import/resolver": {
        typescript: true,
        node: true,
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

  // Tailwind CSS files with v4 directives (@theme, @source, @custom-variant)
  {
    files: ["**/packages/sail-ui/src/*.css", "**/packages/sail-app/src/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
    rules: {
      "css/no-invalid-at-rules": "off",
      "css/no-parsing-error": "off",
    },
  },

  // Prettier integration - must be last to override conflicting rules
  prettier,
])
