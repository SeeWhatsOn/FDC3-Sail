#!/usr/bin/env bash
# Report ww delivery queue from plans/work-items/*.md frontmatter.
# Delivered work is recorded in PRD "Work item retention" sections (work item files deleted).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WI="$ROOT/work-items"
echo "Work item queue ($(date -u +%Y-%m-%dT%H:%MZ))"
echo ""
for status in approved in-progress staged waiting_on_user committed pr_awaiting blocked draft escalated; do
  count=0
  slugs=()
  for f in "$WI"/*.md; do
    [[ -f "$f" ]] || continue
    if grep -q "^status: ${status}$" "$f" 2>/dev/null; then
      slug=$(grep -m1 '^slug:' "$f" | sed 's/^slug: //')
      slugs+=("$slug")
      count=$((count + 1))
    fi
  done
  if [[ $count -gt 0 ]]; then
    echo "${status}: ${count}"
    printf '  - %s\n' "${slugs[@]}"
    echo ""
  fi
done
approved=$(grep -rl '^status: approved$' "$WI" 2>/dev/null | wc -l | tr -d ' ')
echo "/ww-deliver eligible (approved): ${approved}"
echo "Delivered work: see active PRD Work item retention + plans/project-docs.md"
