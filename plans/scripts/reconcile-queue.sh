#!/usr/bin/env bash
# Move pr_awaiting work items to done when GitHub PR is merged.
# Requires: gh CLI, authenticated for the repo.
set -euo pipefail
DRY=false
[[ "${1:-}" == "--dry-run" ]] && DRY=true

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WI="$ROOT/work-items"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found; run /ww-reconcile manually or install gh." >&2
  exit 1
fi

updated=0
for f in "$WI"/*.md; do
  [[ -f "$f" ]] || continue
  grep -q '^status: pr_awaiting$' "$f" || continue
  slug=$(grep -m1 '^slug:' "$f" | sed 's/^slug: //')
  pr_url=$(grep -m1 '^pr_url:' "$f" 2>/dev/null | sed 's/^pr_url: //' | tr -d '"' || true)
  if [[ -z "$pr_url" ]]; then
    echo "skip $slug: pr_awaiting but no pr_url" >&2
    continue
  fi
  state=$(gh pr view "$pr_url" --json state -q .state 2>/dev/null || echo "UNKNOWN")
  if [[ "$state" == "MERGED" ]]; then
    echo "${DRY:+[dry-run] }$slug: MERGED -> done (delete work item; record in parent PRD Work item retention)"
    if [[ "$DRY" == false ]]; then
      git rm -f "$f" 2>/dev/null || rm -f "$f"
      updated=$((updated + 1))
    fi
  else
    echo "$slug: PR state=$state ($pr_url)"
  fi
done

echo "Updated ${updated} work item(s)."
"$ROOT/scripts/queue-status.sh"
