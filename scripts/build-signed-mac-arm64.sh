#!/usr/bin/env bash
# Build, sign, and notarize Video Merger for Apple Silicon (arm64 fat).
#
# Prerequisites:
#   - .env.local in repo root (see .env.example / docs/local/CODE_SIGNING_SETUP.md)
#   - Developer ID Application cert in login keychain
#
# Usage:
#   ./scripts/build-signed-mac-arm64.sh              # sign + notarize
#   ./scripts/build-signed-mac-arm64.sh --install    # also copy to /Applications
#   ./scripts/build-signed-mac-arm64.sh --sign-only  # sign only (no notarization)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env.local"
INSTALL=false
SIGN_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --install) INSTALL=true ;;
    --sign-only) SIGN_ONLY=true ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)"
      exit 1
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "Create it with CSC_NAME, APPLE_TEAM_ID, APPLE_ID, and APPLE_APP_SPECIFIC_PASSWORD."
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a
echo "Loaded $ENV_FILE"

require_var() {
  if [[ -z "${!1:-}" ]]; then
    echo "Missing $1 in .env.local"
    exit 1
  fi
}

require_var CSC_NAME

if [[ "$SIGN_ONLY" == true ]]; then
  unset APPLE_TEAM_ID APPLE_ID APPLE_APP_SPECIFIC_PASSWORD
  echo "Sign-only mode (notarization disabled for this build)"
else
  require_var APPLE_TEAM_ID
  require_var APPLE_ID
  require_var APPLE_APP_SPECIFIC_PASSWORD
  echo "Checking notarization credentials with Apple..."
  if ! xcrun notarytool history \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    >/dev/null 2>&1; then
    echo "Notarization auth failed. Fix APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID in .env.local"
    exit 1
  fi
  echo "Notarization credentials OK"
fi

export CSC_NAME

echo "Building arm64 fat (ffmpeg bundled)..."
killall "Video Merger" 2>/dev/null || true
rm -rf dist/mac-arm64
npm run build:fat:arm64

APP="$ROOT/dist/mac-arm64/Video Merger.app"
if [[ ! -d "$APP" ]]; then
  echo "Build finished but app not found at: $APP"
  exit 1
fi

DMG=""
for candidate in "$ROOT"/dist/Video\ Merger-*-arm64-fat.dmg; do
  if [[ -f "$candidate" ]]; then
    DMG="$candidate"
    break
  fi
done

if [[ "$SIGN_ONLY" != true ]] && [[ -n "$DMG" ]] && [[ -f "$DMG" ]]; then
  if ! xcrun stapler validate "$DMG" >/dev/null 2>&1; then
    echo "Stapling notarization ticket to DMG..."
    xcrun stapler staple "$DMG"
  fi
fi

echo "Verifying signature..."
if [[ -n "$DMG" ]]; then
  npm run verify-signed-build -- "$APP" "$DMG" || true
else
  npm run verify-signed-build -- "$APP" || true
fi

if [[ "$INSTALL" == true ]]; then
  echo "Installing to /Applications/Video Merger.app ..."
  rm -rf "/Applications/Video Merger.app"
  cp -R "$APP" "/Applications/Video Merger.app"
  xattr -cr "/Applications/Video Merger.app"
  open "/Applications/Video Merger.app"
fi

echo "Done."
echo "  App: $APP"
[[ -n "$DMG" ]] && echo "  DMG: $DMG"
