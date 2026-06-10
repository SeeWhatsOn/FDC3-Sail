# @finos/sail-conformance-harness

Minimal React host for the [FINOS FDC3 conformance toolbox](https://fdc3.finos.org/toolbox/fdc3-conformance/) — wires only `@finos/sail-desktop-agent` (no full Sail stack).

## Documentation

[finos.github.io/FDC3-Sail/docs/packages/conformance-harness/overview](https://finos.github.io/FDC3-Sail/docs/packages/conformance-harness/overview)

## Run

From the monorepo root (`npm install` at repo root — shared dev tooling is hoisted from the root workspace):

```bash
npm run dev -w @finos/sail-conformance-harness
```

Dev server: **http://localhost:3001**

```bash
npm test -w @finos/sail-conformance-harness
npm run typecheck -w @finos/sail-conformance-harness
```
