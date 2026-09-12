#!/usr/bin/env bash
# Build, sign, and notarize Video Merger for Intel (x64 fat).
# Wrapper around scripts/build-signed-mac-fat.sh.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/scripts/build-signed-mac-fat.sh" x64 "$@"
