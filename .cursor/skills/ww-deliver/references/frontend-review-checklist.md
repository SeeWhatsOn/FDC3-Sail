# Frontend Review Checklist

Use in Phase D when [frontend-surface-detection.md](frontend-surface-detection.md)
reports `ui_surface: yes`. Paste this block into the `code-reviewer` brief
(do not load as a separate skill — stays within the 2-skill budget with
`frontend-ui-engineering`).

## Lifecycle and leaks (all frameworks)

- [ ] Subscriptions, timers, listeners, and fetches **return cleanup** from
  effects / teardown hooks (`useEffect` return, Vue `onUnmounted`, Svelte
  `onDestroy`, etc.)
- [ ] No `setState` / reactive updates after unmount (watch StrictMode
  double-mount in dev)
- [ ] Long-lived service instances (stores, harnesses, clients) use
  **`useRef` / module scope**, not `useState`, unless the instance is
  truly reactive UI state
- [ ] No unbounded in-memory arrays rendered in UI (event logs, message
  lists) without an explicit cap or pagination strategy

## React / JSX (when `.tsx` / `.jsx` present)

- [ ] Effect cleanups for every `subscribe`, `addEventListener`, `setInterval`
- [ ] Stable deps: avoid missing `[harness]` / stale closures; prefer ref for
  instance handles
- [ ] Interactive controls use `<button>` (or correct role + keyboard), not
  clickable `<div>` without a11y
- [ ] Lists use stable `key` props; no index keys for mutable lists

## Vue / Svelte (when `.vue` / `.svelte` present)

- [ ] Watchers and event bus listeners removed on teardown
- [ ] No direct DOM manipulation bypassing the framework without justification

## HTML / CSS (when `.html`, `.css`, or style manifest entries present)

- [ ] Semantic structure (`main`, headings in order, `label`/`for` on forms)
- [ ] Spacing/colors from project scale — no arbitrary magic numbers without
  reason
- [ ] Focus visible; sufficient contrast for text and controls
- [ ] No secrets, tokens, or raw credentials in markup or CSS content props

## Report

Under **Important Issues**, list any failed checklist items. Hook leak or
missing effect cleanup on user-facing code is at least **Important** —
block `VERDICT: PASS` if it can cause leaks or updates after unmount.

