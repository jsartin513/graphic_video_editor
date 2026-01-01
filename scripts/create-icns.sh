#!/bin/bash
# Create .icns file from PNG icon for macOS

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ICONS_DIR="$PROJECT_ROOT/build/icons"

# Icon sizes needed for .icns (macOS requires these specific sizes)
declare -a SIZES=(
  "16"
  "32"
  "64"
  "128"
  "256"
  "512"
  "1024"
)

# Create iconset directory
ICONSET_DIR="$ICONS_DIR/icon.iconset"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

# Check if we have the base PNG
if [ ! -f "$ICONS_DIR/icon-512.png" ]; then
    echo "❌ Error: icon-512.png not found. Run scripts/generate-icon.js first."
    exit 1
fi

echo "📐 Creating icon sizes..."

# Generate all required sizes from the 512x512 PNG
for SIZE in "${SIZES[@]}"; do
    echo "   Creating ${SIZE}x${SIZE}..."
    
    # Regular resolution - preserve alpha channel
    sips -z "$SIZE" "$SIZE" "$ICONS_DIR/icon-512.png" --deleteColorManagementProperties --out "$ICONSET_DIR/icon_${SIZE}x${SIZE}.png" > /dev/null
    
    # High resolution (@2x) - except for 1024 (which is already @2x for 512)
    if [ "$SIZE" != "1024" ]; then
        HIGH_RES=$((SIZE * 2))
        sips -z "$HIGH_RES" "$HIGH_RES" "$ICONS_DIR/icon-512.png" --deleteColorManagementProperties --out "$ICONSET_DIR/icon_${SIZE}x${SIZE}@2x.png" > /dev/null
    fi
done

# Create the .icns file
echo "📦 Creating .icns file..."
iconutil -c icns "$ICONSET_DIR" -o "$ICONS_DIR/icon.icns"

if [ -f "$ICONS_DIR/icon.icns" ]; then
    echo "✅ Success! Created: $ICONS_DIR/icon.icns"
    echo "📏 Icon file size: $(du -h "$ICONS_DIR/icon.icns" | cut -f1)"
else
    echo "❌ Error: Failed to create .icns file"
    exit 1
fi

# Clean up iconset directory (optional - we can keep it for debugging)
# rm -rf "$ICONSET_DIR"
# echo "🧹 Cleaned up temporary iconset directory"

