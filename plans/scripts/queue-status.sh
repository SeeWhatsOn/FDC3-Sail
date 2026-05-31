#!/usr/bin/env bash
# Report ww delivery queue from plans/work-items/*.md frontmatter.
# Done items are reported from plans/completed-work-items/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WI="$ROOT/work-items"
COMPLETED="$ROOT/completed-work-items"
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
# done — archived under completed-work-items/
count=0
slugs=()
if [[ -d "$COMPLETED" ]]; then
  for f in "$COMPLETED"/*.md; do
    [[ -f "$f" ]] || continue
    if grep -q '^status: done$' "$f" 2>/dev/null; then
      slug=$(grep -m1 '^slug:' "$f" | sed 's/^slug: //')
      slugs+=("$slug")
      count=$((count + 1))
    fi
  done
fi
if [[ $count -gt 0 ]]; then
  echo "done: ${count} (plans/completed-work-items/)"
  printf '  - %s\n' "${slugs[@]}"
  echo ""
fi
approved=$(grep -rl '^status: approved$' "$WI" 2>/dev/null | wc -l | tr -d ' ')
echo "/ww-deliver eligible (approved): ${approved}"
