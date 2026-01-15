import rootConfig from "../../eslint.config.mjs"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import css from "@eslint/css"

export default tseslint.config(
  // Inherit all the rules from the root configuration
  ...rootConfig,

  // Add/override rules specifically for this package
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },

  // Tailwind CSS files with v4 directives specific to this package
  {
    files: ["src/**/*.css"],
    plugins: { css },
    language: "css/css",
    rules: {
      "css/no-invalid-at-rules": "off",
      "css/no-parsing-error": "off",
    },
  },
)
