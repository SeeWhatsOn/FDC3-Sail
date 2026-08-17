# Work Item Tags

Optional frontmatter field for routing domain skills and optional
security audit during delivery. Generic subagents stay unmodified; the
orchestrator reads tags and includes skill-load lines in task briefs.

```yaml
tags: []   # optional — omit or empty when none apply
```

## Allowed tags

| Tag | Use when | Delivery effect |
|-----|----------|-----------------|
| `ui` | User-facing UI change | `implement-agent` brief adds `frontend-ui-engineering` when no UI-surface auto-detect; delivery also auto-loads it when manifest/diff matches [frontend-surface-detection.md](../../ww-deliver-work-items/references/frontend-surface-detection.md) |
| `api` | New or changed API surface | `implement-agent` brief adds `api-and-interface-design` |
| `fdc3` | FDC3 / interop work | `implement-agent` brief adds `fdc3-expert` |
| `security` | Auth, secrets, trust boundaries | `implement-agent` brief adds `security-and-hardening`; optional Phase D.5 `security-auditor` |
| `perf` | Performance-sensitive change | `implement-agent` brief adds `performance-optimization` |
| `migration` | Deprecation or migration | `implement-agent` brief adds `deprecation-and-migration` |

Use one or more tags. Do not invent tags outside this list unless the
human explicitly adds a project convention during planning.

## Planning guidance

During `/ww-plan`, set tags when the PRD clearly implies them. When
uncertain, omit tags rather than guess.

