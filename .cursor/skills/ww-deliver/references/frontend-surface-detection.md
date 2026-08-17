# Frontend Surface Detection

Use this to decide when UI-specific implement and review skills apply.
Do **not** rely on the `ui` tag alone — inspect `file_manifest` and the
actual diff.

## UI surface glob

A path is a **UI surface file** when it matches any of:

```text
**/*.{tsx,jsx,vue,svelte,html,css,scss,less}
**/*.module.css
index.html
```

Also treat manifest entries that clearly name UI entry or panel files
(for example `src/main.tsx`, `src/ui/DiagnosticsPanel.tsx`) as UI
surface even if a glob is abbreviated.

## Orchestrator decision

Before Phase B and Phase D, compute:

```text
ui_surface: yes | no
ui_surface_files: [list matching manifest + diff paths]
```

| Phase | When `ui_surface: yes` |
|-------|-------------------------|
| B `implement-agent` | Load `frontend-ui-engineering` as the domain skill (replaces tag-based domain pick for this phase) |
| D `code-reviewer` | Load `code-review-and-quality` **and** `frontend-ui-engineering` (2 skills) + inline [frontend-review-checklist.md](frontend-review-checklist.md) |

When `ui_surface: no`, keep existing tag-based domain routing for Phase B
and single-skill review for Phase D.

Record `ui_surface: yes|no` in the phase audit table.

## Tag interaction

- `tags: [ui]` alone does **not** replace detection — still compute from
  files.
- `tags: [fdc3]` with UI surface files → Phase B uses
  `frontend-ui-engineering` (UI wiring dominates). Note in phase audit if
  FDC3 domain review was deferred to behavior spec / tests.
- Planning (`/ww-plan`) should still add `ui` when the PRD is UI-heavy;
  detection is the delivery safety net.

