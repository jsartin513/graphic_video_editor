#!/usr/bin/env bash
# Print a copy-paste message for friends after a release.
# Usage: ./scripts/print-friend-release-message.sh [version]
#   version defaults to package.json

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-$(node -p "require('$ROOT/package.json').version")}"
URL="https://github.com/jsartin513/graphic_video_editor/releases/latest"

cat <<EOF

--- Copy for friends (Video Merger ${VERSION}) ---

Video Merger ${VERSION} is ready.

1. Apple menu → About This Mac.
   • Apple chip (M1/M2/M3/M4) → download the **arm64-fat** .dmg
   • Intel → download the **x64-fat** .dmg
2. Open the DMG, drag Video Merger to Applications, open from Applications.

Download: ${URL}

Needs macOS 10.15+. ffmpeg is already inside the app.

If you installed an older build before, replace the app once; later updates can install from Settings → Check for updates.

--- end ---

EOF
