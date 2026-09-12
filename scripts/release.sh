#!/usr/bin/env bash
# Bump version, build signed fat DMGs (arm64 + x64), and create a GitHub release.
#
# Usage:
#   ./scripts/release.sh patch
#   ./scripts/release.sh minor
#   ./scripts/release.sh 1.3.0
#   ./scripts/release.sh patch --install    # also install arm64 build locally
#   ./scripts/release.sh patch --no-push    # create release locally without git push
#
# Requires: .env.local signing vars, gh CLI, clean git tree on main (recommended).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUMP=""
INSTALL=false
NO_PUSH=false
NOTES_FILE=""

usage() {
  sed -n '2,11p' "$0"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    patch|minor|major) BUMP="$1" ;;
    --install) INSTALL=true ;;
    --no-push) NO_PUSH=true ;;
    --notes)
      NOTES_FILE="${2:-}"
      if [[ -z "$NOTES_FILE" ]]; then
        echo "--notes requires a file path"
        exit 1
      fi
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ -z "$BUMP" ]] && [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
        BUMP="$1"
      else
        echo "Unknown argument: $1"
        usage
        exit 1
      fi
      ;;
  esac
  shift
done

if [[ -z "$BUMP" ]]; then
  echo "Missing version bump (patch, minor, major, or X.Y.Z)."
  usage
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required. Install from https://cli.github.com/"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty. Commit or stash changes before releasing."
  git status --short
  exit 1
fi

echo "Running tests..."
npm test

echo "Checking signing setup..."
npm run check-signing

OLD_VERSION="$(node -p "require('./package.json').version")"
if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]] && [[ "$OLD_VERSION" == "$BUMP" ]]; then
  echo "package.json already at ${OLD_VERSION}; skipping version bump."
  NEW_VERSION="$OLD_VERSION"
else
  echo "Bumping version from ${OLD_VERSION} (${BUMP})..."
  npm version "$BUMP" --no-git-tag-version
  NEW_VERSION="$(node -p "require('./package.json').version")"
fi
TAG="v${NEW_VERSION}"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag ${TAG} already exists locally."
  exit 1
fi
if gh release view "$TAG" --repo "$(gh repo view --json nameWithOwner -q .nameWithOwner)" >/dev/null 2>&1; then
  echo "GitHub release ${TAG} already exists."
  exit 1
fi

chmod +x "$ROOT/scripts/build-signed-mac-fat.sh"

echo "Building signed arm64 fat with update metadata..."
PUBLISH_TO_GITHUB=true "$ROOT/scripts/build-signed-mac-fat.sh" arm64

echo "Building signed x64 fat with update metadata..."
PUBLISH_TO_GITHUB=true "$ROOT/scripts/build-signed-mac-fat.sh" x64

ARM_YML="$ROOT/dist/latest-mac-arm64.yml"
X64_YML="$ROOT/dist/latest-mac-x64.yml"
MERGED_YML="$ROOT/dist/latest-mac.yml"
if [[ ! -f "$ARM_YML" || ! -f "$X64_YML" ]]; then
  echo "Missing per-arch latest-mac.yml files. Expected:"
  echo "  $ARM_YML"
  echo "  $X64_YML"
  exit 1
fi
node "$ROOT/scripts/merge-latest-mac-yml.js" "$ARM_YML" "$X64_YML" "$MERGED_YML"

RELEASE_DIR="$ROOT/dist/release-${NEW_VERSION}"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

shopt -s nullglob
for f in "$ROOT/dist"/Video\ Merger-*-arm64-fat.dmg \
         "$ROOT/dist"/Video\ Merger-*-x64-fat.dmg \
         "$ROOT/dist"/Video\ Merger-*-arm64-fat.zip \
         "$ROOT/dist"/Video\ Merger-*-x64-fat.zip \
         "$ROOT/dist"/Video\ Merger-*-arm64-fat.zip.blockmap \
         "$ROOT/dist"/Video\ Merger-*-x64-fat.zip.blockmap; do
  cp "$f" "$RELEASE_DIR/"
done
cp "$MERGED_YML" "$RELEASE_DIR/"

if [[ $(ls -1 "$RELEASE_DIR" | wc -l | tr -d ' ') -lt 3 ]]; then
  echo "Release directory is missing expected artifacts:"
  ls -la "$RELEASE_DIR"
  exit 1
fi

git add package.json package-lock.json
git commit -m "Release ${NEW_VERSION}"

git tag -a "$TAG" -m "Release ${NEW_VERSION}"

RELEASE_NOTES="Video Merger ${NEW_VERSION} — signed fat builds for Apple Silicon and Intel.

Install the fat DMG for your Mac (ffmpeg bundled). Requires macOS 10.15+.

This build includes in-app update metadata; installs from older DMGs without it should replace the app once, then future updates can install from the app."

if [[ -n "$NOTES_FILE" && -f "$NOTES_FILE" ]]; then
  RELEASE_NOTES="$(cat "$NOTES_FILE")"
fi

echo "Creating GitHub release ${TAG}..."
gh release create "$TAG" \
  --title "Video Merger ${NEW_VERSION}" \
  --notes "$RELEASE_NOTES" \
  "$RELEASE_DIR"/*

if [[ "$INSTALL" == true ]]; then
  PUBLISH_TO_GITHUB=true "$ROOT/scripts/build-signed-mac-fat.sh" arm64 --install
fi

if [[ "$NO_PUSH" == true ]]; then
  echo "Skipping git push (--no-push). Push manually:"
  echo "  git push origin HEAD"
  echo "  git push origin ${TAG}"
else
  echo "Pushing commit and tag..."
  git push origin HEAD
  git push origin "$TAG"
fi

echo ""
echo "Release ${TAG} is ready."
echo "  Version in package.json: ${NEW_VERSION}"
echo "  Assets: ${RELEASE_DIR}"
echo "  GitHub: https://github.com/jsartin513/graphic_video_editor/releases/tag/${TAG}"
"$ROOT/scripts/print-friend-release-message.sh" "$NEW_VERSION"
