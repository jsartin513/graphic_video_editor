# Installation Troubleshooting

## Signed builds (the happy path)

A notarized Video Merger DMG should open after you drag it to Applications. No Terminal commands.

If that is not what you downloaded, you have an unsigned or ad-hoc build.

## "App is Damaged" or "Can't be Opened"

macOS Gatekeeper blocks **unsigned** apps. This is not corruption.

### Quick fix (unsigned builds only)

1. Right-click (Control-click) **Video Merger.app** in Applications
2. Choose **Open**
3. Click **Open** in the warning dialog

### Alternative: remove quarantine

```bash
xattr -cr /Applications/Video\ Merger.app
```

Then open the app normally.

### Permanent fix (developers)

1. Developer ID Application certificate ($99/year Apple Developer Program)
2. Sign with that certificate (`CSC_NAME=...`)
3. Notarize (`APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_SPECIFIC_PASSWORD`)

See [docs/local/CODE_SIGNING_SETUP.md](docs/local/CODE_SIGNING_SETUP.md) and [docs/local/GET_CERTIFICATE_STEPS.md](docs/local/GET_CERTIFICATE_STEPS.md).
