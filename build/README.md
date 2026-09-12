# Build Resources

`electron-builder` reads this folder when packaging Video Merger.

## Icon

- `icon.icns` — macOS app icon (committed; generated from `icons/icon.svg`)
- `icons/` — SVG source, PNG sizes, and iconset used by `scripts/create-icns.sh`

Regenerate:

```bash
npm run generate-icon
cp build/icons/icon.icns build/icon.icns
```

## Entitlements

`entitlements.mac.plist` — hardened runtime entitlements for Developer ID signing (not App Sandbox).
