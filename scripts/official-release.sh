#!/usr/bin/env bash
# Official Video Merger release: preflight checks, then scripts/release.sh.
#
# Usage:
#   ./scripts/official-release.sh 1.3.0
#   ./scripts/official-release.sh patch
#   ./scripts/official-release.sh minor --install
#   ./scripts/official-release.sh patch --yes          # skip confirmation prompt
#   ./scripts/official-release.sh patch --allow-branch  # not on main (use sparingly)
#
# See RELEASE.md and .cursor/skills/release-video-merger/SKILL.md

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RELEASE_URL="https://github.com/jsartin513/graphic_video_editor/releases/latest"
ALLOW_BRANCH=false
SKIP_CONFIRM=false
RELEASE_ARGS=()

usage() {
  cat <<'EOF'
Official Video Merger release (preflight + signed builds + GitHub release).

  ./scripts/official-release.sh <patch|minor|major|X.Y.Z> [release.sh options]

Options:
  --yes, -y           Skip "Proceed with release?" prompt
  --allow-branch      Allow release when not on main/master
  --install           Install arm64 build to /Applications after release
  --no-push           Do not git push (passed to release.sh)
  --notes <file>      Custom GitHub release notes file

Examples:
  npm run official-release -- 1.3.0
  npm run official-release -- patch --install
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --yes|-y)
      SKIP_CONFIRM=true
      ;;
    --allow-branch)
      ALLOW_BRANCH=true
      ;;
    *)
      RELEASE_ARGS+=("$1")
      ;;
  esac
  shift
done

if [[ ${#RELEASE_ARGS[@]} -eq 0 ]]; then
  echo "Missing version bump (patch, minor, major, or X.Y.Z)."
  usage
  exit 1
fi

fail() {
  echo "❌ $1"
  exit 1
}

echo "=== Video Merger official release preflight ==="
echo ""

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is required."
fi
if ! command -v npm >/dev/null 2>&1; then
  fail "npm is required."
fi
if ! command -v gh >/dev/null 2>&1; then
  fail "GitHub CLI (gh) is required. Install from https://cli.github.com/"
fi
if ! gh auth status >/dev/null 2>&1; then
  fail "gh is not logged in. Run: gh auth login"
fi

ENV_FILE="$ROOT/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  fail "Missing $ENV_FILE — copy from docs/local/CODE_SIGNING_SETUP.md and fill in Apple signing vars."
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" && "$BRANCH" != "master" ]]; then
  if [[ "$ALLOW_BRANCH" != true ]]; then
    fail "You are on branch '$BRANCH'. Switch to main or pass --allow-branch (not recommended for friend drops)."
  fi
  echo "⚠️  Releasing from branch: $BRANCH"
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Uncommitted changes:"
  git status --short
  fail "Working tree must be clean before an official release."
fi

if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
  git fetch origin "$BRANCH" --quiet 2>/dev/null || true
  BEHIND="$(git rev-list --count HEAD..@{u} 2>/dev/null || echo 0)"
  AHEAD="$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)"
  if [[ "${BEHIND:-0}" -gt 0 ]]; then
    fail "Branch is ${BEHIND} commit(s) behind upstream. Pull before releasing."
  fi
  if [[ "${AHEAD:-0}" -gt 0 ]]; then
    echo "ℹ️  Branch is ${AHEAD} commit(s) ahead of upstream (will push release commit + tag)."
  fi
fi

CURRENT_VERSION="$(node -p "require('./package.json').version")"
BUMP_ARG="${RELEASE_ARGS[0]}"
echo "Current package.json version: ${CURRENT_VERSION}"
echo "Requested bump: ${BUMP_ARG}"
echo "Repo: $(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo unknown)"
echo ""

if [[ "$SKIP_CONFIRM" != true ]]; then
  echo "This will: run tests, bump version, sign+notarize arm64 and x64 fat builds,"
  echo "create GitHub release v* with DMGs/zips/latest-mac.yml, and push commit+tag."
  echo ""
  read -r -p "Proceed with official release? [y/N] " REPLY
  if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
  fi
fi

echo ""
exec "$ROOT/scripts/release.sh" "${RELEASE_ARGS[@]}"
