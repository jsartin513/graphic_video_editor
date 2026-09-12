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

Use the release script on `main` with a clean tree and `.env.local` signing vars configured:

```bash
npm run check-signing
npm run release -- patch   # or minor, or an explicit X.Y.Z
```

See [RELEASE.md](RELEASE.md) for the full flow (signed DMGs, `latest-mac.yml`, GitHub release, git tag).

One-off signed builds without shipping a version:

```bash
npm run build:signed:arm64
npm run build:signed:x64
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

Releases created with `npm run release` include signed artifacts and `latest-mac.yml`. Installs from older DMGs without update metadata still need a one-time DMG replace; after that, in-app updates work. See [RELEASE.md](RELEASE.md).

## Versioning

- v1.0.0 — first friend-ready build
- v1.0.1 — bug fix
- v1.1.0 — new features

Paid checkout, LGPL ffmpeg, and the Mac App Store are documented in [FUTURE_RELEASE.md](FUTURE_RELEASE.md).
