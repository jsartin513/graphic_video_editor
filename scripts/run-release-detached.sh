#!/usr/bin/env bash
# Run official release fully detached from the parent shell (for automation).
# Prefer run-release-in-terminal.sh when you want a visible Terminal window.
#
# Usage:
#   ./scripts/run-release-detached.sh 1.3.0
#   npm run release:detached -- 1.3.0

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <patch|minor|major|X.Y.Z>"
  exit 1
fi

LOG="${RELEASE_LOG:-$ROOT/docs/local/release-${VERSION}.log}"
PIDFILE="${LOG}.pid"
mkdir -p "$(dirname "$LOG")"

if [[ -f "$PIDFILE" ]]; then
  OLD_PID="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [[ -n "$OLD_PID" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Release already running (PID $OLD_PID). Log: $LOG"
    exit 1
  fi
fi

nohup env CI= npm run official-release -- "$VERSION" --yes >>"$LOG" 2>&1 &
REL_PID=$!
echo "$REL_PID" >"$PIDFILE"
disown "$REL_PID" 2>/dev/null || true

echo "Detached release PID $REL_PID"
echo "Log: $LOG"
echo "Tail: tail -f \"$LOG\""
