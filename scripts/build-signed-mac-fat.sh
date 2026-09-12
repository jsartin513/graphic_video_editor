#!/usr/bin/env bash
# Build, sign, and notarize a fat Video Merger package for one macOS architecture.
#
# Prerequisites:
#   - .env.local in repo root (see docs/local/CODE_SIGNING_SETUP.md)
#   - Developer ID Application cert in login keychain
#
# Usage:
#   ./scripts/build-signed-mac-fat.sh arm64
#   ./scripts/build-signed-mac-fat.sh x64
#   ./scripts/build-signed-mac-fat.sh arm64 --install
#   ./scripts/build-signed-mac-fat.sh arm64 --sign-only
#   PUBLISH_TO_GITHUB=true ./scripts/build-signed-mac-fat.sh arm64   # embed app-update.yml + latest-mac.yml

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env.local"
ARCH=""
INSTALL=false
SIGN_ONLY=false

usage() {
  sed -n '2,14p' "$0"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    arm64|x64) ARCH="$1" ;;
    --install) INSTALL=true ;;
    --sign-only) SIGN_ONLY=true ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ -z "$ARCH" ]]; then
  echo "Missing architecture (arm64 or x64)."
  usage
  exit 1
fi

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

if [[ "$ARCH" == arm64 ]]; then
  MAC_DIR="mac-arm64"
  ARCH_LABEL="arm64"
  PREBUILD="prebuild:arm64"
  BUILD_NPM="build:fat:arm64"
elif [[ "$ARCH" == x64 ]]; then
  MAC_DIR="mac"
  ARCH_LABEL="x64"
  PREBUILD="prebuild:x64"
  BUILD_NPM="build:fat:x64"
else
  echo "Unsupported arch: $ARCH"
  exit 1
fi

PUBLISH_ARGS=()
if [[ "${PUBLISH_TO_GITHUB:-}" == "true" ]]; then
  export PUBLISH_TO_GITHUB=true
  PUBLISH_ARGS=(--publish never)
  echo "Update metadata: PUBLISH_TO_GITHUB=true, electron-builder --publish never"
fi

echo "Building ${ARCH_LABEL} fat (ffmpeg bundled)..."
killall "Video Merger" 2>/dev/null || true
rm -rf "$ROOT/dist/${MAC_DIR}"
rm -f "$ROOT"/dist/Video\ Merger-*-"${ARCH_LABEL}"-fat.dmg "$ROOT"/dist/Video\ Merger-*-"${ARCH_LABEL}"-fat.zip

if [[ ${#PUBLISH_ARGS[@]} -gt 0 ]]; then
  BUNDLE_FFMPEG=true npm run "$PREBUILD"
  BUNDLE_FFMPEG=true PUBLISH_TO_GITHUB=true npx electron-builder \
    --config electron-builder.config.js \
    --mac \
    --"${ARCH_LABEL}" \
    "${PUBLISH_ARGS[@]}"
else
  npm run "$BUILD_NPM"
fi

APP="$ROOT/dist/${MAC_DIR}/Video Merger.app"
if [[ ! -d "$APP" ]]; then
  echo "Build finished but app not found at: $APP"
  exit 1
fi

if [[ "${PUBLISH_TO_GITHUB:-}" == "true" && -f "$ROOT/dist/latest-mac.yml" ]]; then
  cp "$ROOT/dist/latest-mac.yml" "$ROOT/dist/latest-mac-${ARCH_LABEL}.yml"
  echo "Saved dist/latest-mac-${ARCH_LABEL}.yml"
fi

DMG=""
for candidate in "$ROOT"/dist/Video\ Merger-*-"${ARCH_LABEL}"-fat.dmg; do
  if [[ -f "$candidate" ]]; then
    DMG="$candidate"
    break
  fi
done

# electron-builder notarizes Video Merger.app before the DMG is created. The ticket
# is on the .app, not the DMG wrapper — stapling the DMG always fails with "Record not found".
APP_STAPLED=false
if [[ "$SIGN_ONLY" != true ]]; then
  if xcrun stapler validate "$APP" >/dev/null 2>&1; then
    APP_STAPLED=true
    echo "✅ App notarization ticket already stapled"
  else
    echo "Stapling notarized Video Merger.app (DMG staple is not used)..."
    sleep 20
    for attempt in 1 2 3 4 5 6 7 8; do
      echo "Stapling .app (attempt ${attempt})..."
      if xcrun stapler staple "$APP" 2>/dev/null && xcrun stapler validate "$APP" >/dev/null 2>&1; then
        APP_STAPLED=true
        echo "✅ App staple OK"
        break
      fi
      sleep $((attempt * 15))
    done
    if [[ "$APP_STAPLED" != true ]]; then
      echo "⚠️  App not stapled yet. Try later: xcrun stapler staple \"$APP\""
    fi
  fi
fi

echo "Verifying signature..."
npm run verify-signed-build -- "$APP"

if [[ "$INSTALL" == true ]]; then
  if [[ "$ARCH" != arm64 ]]; then
    echo "--install is only supported for arm64 (local dev machine)."
    exit 1
  fi
  echo "Installing to /Applications/Video Merger.app ..."
  rm -rf "/Applications/Video Merger.app"
  cp -R "$APP" "/Applications/Video Merger.app"
  xattr -cr "/Applications/Video Merger.app"
  open "/Applications/Video Merger.app"
fi

echo "Done."
echo "  App: $APP"
[[ -n "$DMG" ]] && echo "  DMG: $DMG"
