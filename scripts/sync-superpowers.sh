#!/usr/bin/env bash
# Sync the forked superpowers skills in skills/ against upstream obra/superpowers.
#
#   scripts/sync-superpowers.sh            # sync to upstream dev HEAD (or existing clone)
#   scripts/sync-superpowers.sh v6.4.0     # sync to a tag/branch/commit
#
# What it does:
#   1. Ensures a clone of upstream exists at $SYNC_DIR (default /tmp/superpowers-sync).
#   2. Checks out the requested ref (default: whatever the clone has).
#   3. rsyncs upstream skills/ into this repo, DELETING removed skills, while
#      preserving this fork's local additions (see PRESERVE below).
#   4. Prints a diff summary for manual review — always review before committing.
#
# The 14 forked skill names live in FORKED; domain skills (magento2-*, govard-*)
# are never touched.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UPSTREAM_URL="https://github.com/obra/superpowers.git"
SYNC_DIR="${SUPERPOWERS_SYNC_DIR:-/tmp/superpowers-sync}"
REF="${1:-}"

# Files this fork adds/overrides inside forked skill dirs — restored after rsync.
PRESERVE=(
  "skills/using-superpowers/references/dsh-tools.md"
)

FORKED=(
  brainstorming dispatching-parallel-agents executing-plans
  finishing-a-development-branch receiving-code-review requesting-code-review
  subagent-driven-development systematic-debugging test-driven-development
  using-git-worktrees using-superpowers verification-before-completion
  writing-plans writing-skills
)

command -v rsync >/dev/null 2>&1 || { echo "rsync is required." >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "git is required." >&2; exit 1; }

if [ -d "$SYNC_DIR/.git" ]; then
  echo "Updating upstream clone at $SYNC_DIR ..." >&2
  git -C "$SYNC_DIR" fetch --all --tags --prune >&2
else
  echo "Cloning upstream into $SYNC_DIR ..." >&2
  git clone --depth 1 "$UPSTREAM_URL" "$SYNC_DIR" >&2
fi

if [ -n "$REF" ]; then
  git -C "$SYNC_DIR" checkout "$REF" >&2
fi

UPSTREAM_HEAD="$(git -C "$SYNC_DIR" rev-parse --short HEAD)"
echo "Syncing superpowers skills from upstream @ $UPSTREAM_HEAD" >&2

# Snapshot the local additions before rsync --delete can remove them.
tmpbak="$(mktemp -d)"
for rel in "${PRESERVE[@]}"; do
  if [ -f "$REPO_ROOT/$rel" ]; then
    mkdir -p "$tmpbak/$(dirname "$rel")"
    cp "$REPO_ROOT/$rel" "$tmpbak/$rel"
  fi
done

rsync -a --delete \
  --include='*/' \
  --include='brainstorming/**' --include='dispatching-parallel-agents/**' \
  --include='executing-plans/**' --include='finishing-a-development-branch/**' \
  --include='receiving-code-review/**' --include='requesting-code-review/**' \
  --include='subagent-driven-development/**' --include='systematic-debugging/**' \
  --include='test-driven-development/**' --include='using-git-worktrees/**' \
  --include='using-superpowers/**' --include='verification-before-completion/**' \
  --include='writing-plans/**' --include='writing-skills/**' \
  --exclude='*' \
  "$SYNC_DIR/skills/" "$REPO_ROOT/skills/"

# Restore local additions.
for rel in "${PRESERVE[@]}"; do
  if [ -f "$tmpbak/$rel" ]; then
    mkdir -p "$REPO_ROOT/$(dirname "$rel")"
    cp "$tmpbak/$rel" "$REPO_ROOT/$rel"
  fi
done
rm -rf "$tmpbak"

echo >&2
echo "Sync complete (upstream @ $UPSTREAM_HEAD). Review before committing:" >&2
echo "  git -C $REPO_ROOT status --short skills/" >&2
echo "  git -C $REPO_ROOT diff --stat -- skills/" >&2
echo "Then update the fork version in THIRD-PARTY-NOTICES.md if it moved." >&2
