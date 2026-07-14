import eslint from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    // __tests__ are excluded from package tsconfigs (build emit); skip type-aware lint there.
    ignores: ["**/*.js", "**/*.mjs", "**/dist/", "**/__tests__/**"],
  },
  {
    files: ["packages/*/src/**/*.{ts,tsx}"],
    extends: [eslint.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
)
