---
sidebar_position: 2
---

# How to Consume Sail

You know what FDC3 is and what Sail does. This page is the decision point: there are three ways to
bring Sail into your organisation, and they are at different stages of readiness. Each is marked
**`[implemented]`** or **`[planned]`** using the same convention as the
[Architecture Overview](./architecture/overview#status-markers) — never read a `[planned]` path as
something you can use today.

## Path 1: Compose the pieces yourself `[implemented]`

Construct a Desktop Agent directly inside your own web application — your state management, your
persistence, your UI — and let Sail supply the FDC3 engine and browser connection layer underneath it.

Sail exposes **two supported entry points** for this: `createSailBrowserDesktopAgent` (agent only) and
`SailPlatform` (agent plus host chrome, lifecycle callbacks, and pluggable persistence). Which one to
reach for depends on how much scaffolding you want the package to own, not on which is more mature —
both end at the same FDC3 engine. See the
[Architecture Overview — Two entry points](./architecture/overview#two-entry-points) for the full
decision rule and diagram; this page does not repeat it.

**Start here:** [Getting Started](./getting-started).

## Path 2: Serve a shell `[implemented]`

Deploy one of Sail's own shells — a ready-made, customisable interop platform — instead of building a
host yourself. Sail ships two:

- **`sail-one`** — a canvas UX: a tab-and-grid workspace with channel wiring.
- **`sail-finance`** — a dashboard UX: a workspace-and-panel layout.

**This is a UX-model choice, not a maturity ranking.** Both are real shells built on the same engine —
`sail-finance` composes `createSailBrowserDesktopAgent` directly, `sail-one` composes `SailPlatform` — and
neither is "the" reference host; pick the layout model that fits how your users want to arrange
applications. See [Architecture Overview](./architecture/overview#2-clear-package-ownership) for how the
two shells relate to the engine.

**Start here:** [Run Sail](./run-sail) covers the `sail-finance` deployment path in detail, including
build, hosting, and app-directory setup — see also [`@finos/sail-finance`](./packages/sail-finance/overview).
A `sail-one` deployment guide is **not yet published** in these docs; until it is, `packages/sail-one/README.md`
in the repository is the current reference.

## Path 3: Use a hosted version `[planned]`

A hosted instance of a Sail shell — so you could point users at a URL instead of deploying anything
yourself — is an intended direction. **It does not exist yet.** There is no hosted address for either
`sail-one` or `sail-finance` today, and who would operate one has not been decided. If you need Sail now,
choose Path 1 or Path 2 above.

## Related

- [Introduction](./intro.md) — what FDC3 and Sail are, and what Sail grows into.
- [Architecture Overview](./architecture/overview) — package ownership, entry points, host-contract
  surface.
- [Add your app to Sail](./add-your-app) — for app developers connecting an existing app to any Sail
  deployment.
