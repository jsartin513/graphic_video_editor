# Build Resources

This directory contains resources needed for building the app.

## Icon

To create a proper macOS icon:

1. Create an icon file (1024x1024 PNG) named `icon.png`
2. Convert it to .icns format:
   ```bash
   iconutil -c icns icon.icns -o build/icon.icns
   ```
   Or use an online converter or tool like `iconutil` on macOS.

For now, the app will use the default Electron icon if no icon is provided.

