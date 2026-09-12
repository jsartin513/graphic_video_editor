#!/usr/bin/env bash
# Open macOS Terminal and run an official release (survives Cursor/agent session end).
#
# Usage:
#   ./scripts/run-release-in-terminal.sh 1.3.0
#   npm run release:terminal -- 1.3.0

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <patch|minor|major|X.Y.Z>"
  exit 1
fi

LOG="$ROOT/docs/local/release-${VERSION}.log"
RUNNER="$ROOT/docs/local/run-release-${VERSION}.sh"
mkdir -p "$(dirname "$LOG")"

cat >"$RUNNER" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$ROOT"
{
  echo "=== Release ${VERSION} started \$(date) ==="
  npm run official-release -- ${VERSION} --yes
  echo "=== Release finished exit=\$? \$(date) ==="
} 2>&1 | tee -a "$LOG"
EOF
chmod +x "$RUNNER"

osascript -e "tell application \"Terminal\" to activate" \
  -e "tell application \"Terminal\" to do script \"bash '$RUNNER'\""

echo "Opened Terminal running: $RUNNER"
echo "Log file: $LOG"
