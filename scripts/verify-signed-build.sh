#!/bin/bash
# Verify a packed Video Merger .app is signed (and optionally notarized).
# Usage: scripts/verify-signed-build.sh [path-to-Video-Merger.app] [path-to.dmg]

set -u

APP_PATH="${1:-}"
DMG_PATH="${2:-}"
FAILED=0

if [[ -z "$APP_PATH" ]]; then
  for candidate in \
    "dist/mac-arm64/Video Merger.app" \
    "dist/mac/Video Merger.app" \
    "dist/mac-x64/Video Merger.app"
  do
    if [[ -d "$candidate" ]]; then
      APP_PATH="$candidate"
      break
    fi
  done
fi

if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "Usage: $0 /path/to/Video Merger.app [optional.dmg]"
  echo "No .app found. Build first with: npm run build:fat:arm64"
  exit 1
fi

echo "=== App: $APP_PATH ==="
codesign -dv --verbose=4 "$APP_PATH" 2>&1 | sed -n '1,25p' || true
echo

if codesign -dv --verbose=4 "$APP_PATH" 2>&1 | grep -q "Authority=Developer ID Application"; then
  echo "✅ Signed with Developer ID Application"
else
  echo "❌ Not signed with Developer ID Application (Gatekeeper will block friends)."
  echo "   Create a Developer ID Application cert, then rebuild with CSC_NAME set."
  echo "   See docs/local/GET_CERTIFICATE_STEPS.md"
  FAILED=1
fi

FFMPEG="$APP_PATH/Contents/Resources/resources/ffmpeg"
FFPROBE="$APP_PATH/Contents/Resources/resources/ffprobe"

for helper in "$FFMPEG" "$FFPROBE"; do
  name=$(basename "$helper")
  if [[ ! -f "$helper" ]]; then
    echo "❌ Missing helper: $helper"
    FAILED=1
    continue
  fi
  if codesign -dv --verbose=4 "$helper" 2>&1 | grep -q "Authority=Developer ID Application"; then
    echo "✅ $name is signed with Developer ID"
  else
    echo "❌ $name is not Developer ID signed — notarization will fail"
    FAILED=1
  fi
done

echo
echo "=== Gatekeeper assess (may fail until notarized + stapled) ==="
spctl --assess --type execute --verbose "$APP_PATH" 2>&1 || true

if [[ -n "${DMG_PATH:-}" ]]; then
  echo
  echo "=== DMG staple: $DMG_PATH ==="
  if xcrun stapler validate "$DMG_PATH" 2>&1; then
    echo "✅ DMG notarization ticket is stapled"
  else
    echo "❌ DMG is not stapled (set CSC_NAME + APPLE_ID / APPLE_TEAM_ID / APPLE_APP_SPECIFIC_PASSWORD and rebuild)"
    FAILED=1
  fi
fi

exit "$FAILED"
