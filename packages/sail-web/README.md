# @finos/sail-web

Browser deployment of FDC3 Sail — React host for the Desktop Agent, workspace UI, and FDC3 apps in iframes.

## Documentation

[finos.github.io/FDC3-Sail/docs/packages/sail-web/overview](https://finos.github.io/FDC3-Sail/docs/packages/sail-web/overview)

## Development

```bash
npm run dev          # from monorepo root (hosted FINOS conformance URLs)
npm run dev:local    # from monorepo root (local toolbox profile — same-origin /apps proxy)
npm run dev -w @finos/sail-web
npm run dev:local -w @finos/sail-web
```

Dev server: **http://localhost:3000**

Conformance apps come from `packages/sail-conformance-harness/conformance-appd.json`. Default (`dev`) keeps hosted FINOS URLs. `dev:local` sets `VITE_CONFORMANCE_TOOLBOX=local`, rewrites those URLs to the sail-web origin, and Vite proxies `/apps` to the hosted FINOS toolbox (same pattern as the conformance harness).
