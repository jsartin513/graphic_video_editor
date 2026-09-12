# Distribution Guide for Friends

Share **fat** DMGs only. Lite builds require Homebrew ffmpeg and are for developers.

**Requirements:** macOS 10.15 Catalina or later.

## Current drop (local)

Fat DMGs from this repo (unsigned until a Developer ID Application cert exists):

- Apple Silicon: `dist/Video Merger-1.0.0-arm64-fat.dmg`
- Intel: `dist/Video Merger-1.0.0-x64-fat.dmg`

Do **not** send these to friends until `npm run verify-signed-build` reports Developer ID + a stapled ticket. An unsigned DMG still needs the Gatekeeper workaround in [INSTALLATION_TROUBLESHOOTING.md](INSTALLATION_TROUBLESHOOTING.md).


## Which file

1. Apple menu → **About This Mac**
2. **Chip: Apple M1/M2/M3/M4** → `Video-Merger-*-arm64-fat.dmg`
3. **Processor: Intel** → `Video-Merger-*-x64-fat.dmg`

Prefer the `.dmg` over the `.zip`.

## Install (signed / notarized builds)

1. Open the DMG.
2. Drag **Video Merger** to Applications.
3. Open it from Applications.

That is the whole flow. No Terminal, no `xattr`, no right-click workaround.

If macOS still says the app is damaged, the build was not notarized. See [INSTALLATION_TROUBLESHOOTING.md](INSTALLATION_TROUBLESHOOTING.md) and [docs/local/CODE_SIGNING_SETUP.md](docs/local/CODE_SIGNING_SETUP.md).

## Create a release

```bash
# 1. Confirm Developer ID Application is in the keychain
npm run check-signing

# 2. Notarize locally (do this before the first friend drop)
export CSC_NAME="JESSICA L SARTIN (LKF2468HZ2)"
export APPLE_ID="your-email@example.com"
export APPLE_TEAM_ID="TEAM_ID"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
npm run build:fat:arm64
npm run build:fat:x64
bash scripts/verify-signed-build.sh

# 3. After the signed DMGs look good, tag a version
#    (CI currently ships unsigned artifacts — attach local DMGs or wait for CI signing)
git tag v1.0.0
git push origin v1.0.0
```

Latest GitHub release: https://github.com/jsartin513/graphic_video_editor/releases/latest

## Message to send friends

**Video Merger**

1. Check your Mac: Apple menu → About This Mac.
   - Apple chip (M1/M2/…) → download the **arm64-fat** `.dmg`
   - Intel → download the **x64-fat** `.dmg`
2. Open the DMG, drag Video Merger to Applications, open it from Applications.

Needs macOS 10.15 or later. ffmpeg is already inside the app.

## Auto-updates

In-app updates need signed GitHub Release artifacts plus `latest-mac.yml`. Until CI signing is wired up, send friends a new DMG when you ship a fix.

## Versioning

- v1.0.0 — first friend-ready build
- v1.0.1 — bug fix
- v1.1.0 — new features

Paid checkout, LGPL ffmpeg, and the Mac App Store are documented in [FUTURE_RELEASE.md](FUTURE_RELEASE.md).
