/** @type {import("lint-staged").Configuration} */
export default {
  "**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,mdx,yml,yaml,css,scss,html}":
    "prettier --write",
  // --no-warn-ignored: __tests__ are eslint-ignored (excluded from package tsconfigs)
  // but still match this glob when staged.
  "packages/*/src/**/*.{ts,tsx}":
    "eslint --fix --max-warnings=0 --no-warn-ignored",
}
