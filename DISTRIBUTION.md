# Distribution Guide

## For End Users

### System Requirements

**Fat build (what friends should install):**
- macOS 10.15 Catalina or later
- Intel or Apple Silicon (M1/M2/M3/M4)
- No extra software — ffmpeg is bundled

**Lite build (developers only):**
- macOS 10.15 Catalina or later
- ffmpeg on the system (`brew install ffmpeg`)

End users do **not** need Node.js.

### Installing the App

1. Download the fat DMG for your Mac (`arm64-fat` for Apple Silicon, `x64-fat` for Intel).
2. Open the DMG.
3. Drag **Video Merger** to Applications.
4. Open it from Applications.

Signed and notarized builds open without Gatekeeper workarounds. If you still see "app is damaged", see [INSTALLATION_TROUBLESHOOTING.md](INSTALLATION_TROUBLESHOOTING.md).

Lite builds and the Homebrew installer scripts (`install_prerequisites.sh`) are not the friend install path.

## For Developers

```bash
npm install
npm run build:fat:arm64   # or build:fat:x64
```

Output is in `dist/`.

### Code Signing and Notarization

Friend-ready builds need a **Developer ID Application** certificate and notarization. Config lives in `electron-builder.config.js` and `build/entitlements.mac.plist`.

```bash
npm run check-signing
export CSC_NAME="JESSICA L SARTIN (LKF2468HZ2)"
export APPLE_ID="..."
export APPLE_TEAM_ID="..."
export APPLE_APP_SPECIFIC_PASSWORD="..."
npm run build:fat:arm64
```

Full walkthrough: [docs/local/CODE_SIGNING_SETUP.md](docs/local/CODE_SIGNING_SETUP.md).
