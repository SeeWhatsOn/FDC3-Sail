---
name: fdc3-conformance-progress
overview: Add a reliable test completion signal and a bounded progress indicator for the conformance UI, plus outline Playwright usage steps for the separate platform repo.
todos:
  - id: add-status-ui
    content: Add status/progress DOM hook in index.html
    status: completed
  - id: runner-hooks
    content: Wire mocha runner to update status and emit completion
    status: completed
  - id: styling-docs
    content: Add CSS + brief automation note
    status: completed
isProject: false
---

# FDC3 Conformance Progress & Completion

## Context and goals

- The current UI relies on Mocha’s HTML reporter; it can show a progress indicator that exceeds 100% and there’s no explicit completion signal for automation.
- You run locally and need a Playwright-friendly completion signal; an iframe-safe option is preferred.

## Approach

- Add a small, explicit status/progress block to the conformance UI (DOM hook + data attributes).
- Wire Mocha runner events to update progress and emit a completion signal.
- Emit a `postMessage` to the parent window (when framed) plus a DOM status element for same-origin waits.
- Optionally hide Mocha’s built-in progress indicator to avoid the >100% visual issue.

## Planned code changes (this repo only)

1. **UI: status/progress elements**

- Add a status container to `[toolbox/fdc3-conformance/static/v2.0/app/index.html](toolbox/fdc3-conformance/static/v2.0/app/index.html)` with stable IDs/data attributes (e.g., `data-testid="fdc3-status"`, `data-status`, `data-pack`, `data-mode`).

1. **Runner hooks and completion signal**

- Update `[toolbox/fdc3-conformance/src/test/index.ts](toolbox/fdc3-conformance/src/test/index.ts)` to:
  - Capture the `runner` returned by `mocha.run()`.
  - Listen for `start`, `test end`, `end` events.
  - Compute progress as `completed/total`, clamp to 0–100, and update the new DOM elements.
  - On completion, set `data-status="complete"` and dispatch:
    - `window.dispatchEvent(new CustomEvent('fdc3-conformance:complete', { detail }))`
    - `window.parent.postMessage({ type: 'fdc3-conformance:complete', detail }, '*')` when in an iframe.
  - Include stats (passes, failures, pending, duration, total, pack, mode) in the detail payload.

1. **CSS adjustments**

- Update `[toolbox/fdc3-conformance/static/v2.0/lib/index.css](toolbox/fdc3-conformance/static/v2.0/lib/index.css)` to style the status/progress block and, if needed, hide Mocha’s built-in progress indicator (to eliminate >100% confusion).

## Playwright usage guidance (docs/comments)

- Provide a short note (either in README or inline comments) with selectors and suggested waits:
  - Wait for `data-status="complete"` on `#fdc3-conformance-status`.
  - Or listen for `postMessage` with `type: 'fdc3-conformance:complete'` from the iframe.

## Platform repo guidance (no code changes here)

- Document the Playwright approach to run in the platform repo:
  - Navigate to the conformance page (or iframe), click Run, then wait for the completion signal.
  - If framed, listen for `postMessage` from the iframe; if same-origin, use `frameLocator` and wait on `data-status`.
  - Parse the stats payload from the completion event for pass/fail counts.

## Verification

- Run locally (`npm run dev`), execute a suite, confirm:
  - Progress stays 0–100.
  - Status transitions `idle → running → complete`.
  - Completion event fires and payload includes stats.
  - Playwright can wait on the status element or `postMessage` event.
