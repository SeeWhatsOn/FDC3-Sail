---
title: "FDC3 2.2 conformance traceability map"
slug: conformance-traceability-map
type: docs
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/docs/conformance-traceability.md
  - packages/sail-desktop-agent/test/features/
depends_on: []
integration_branch: ""
branch: docs/conformance-traceability
external_tracker: ""
tags: [fdc3, conformance2.2]
---

## Goal

Publish a maintainable map from FINOS FDC3 2.2 conformance test areas / IDs to in-repo Cucumber scenarios (or explicit “missing” / “partial”).

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 8)
- `AGENTS.md` Cucumber tags

## Deliverable

Markdown table (or CSV in `docs/`) with columns: conformance ID/name, feature file, scenario name, status (covered | partial | missing | n/a), notes.

## Out of scope

- Automating FINOS pack execution inside this repo (may live in platform/toolbox).

## Blocked decisions

Source of truth for conformance IDs (local `fdc3-expert` vs. published FINOS list).
