#!/bin/bash

# Fix "App is Damaged" error for Video Merger
# This removes the quarantine attribute that macOS adds to downloaded apps

APP_NAME="Video Merger.app"
APP_PATH="/Applications/$APP_NAME"

echo "Fixing 'App is Damaged' error for Video Merger..."
echo ""

# Check if app exists in Applications
if [ ! -d "$APP_PATH" ]; then
    echo "Error: $APP_NAME not found in /Applications/"
    echo ""
    echo "Please either:"
    echo "1. Drag the app to /Applications/ first, or"
    echo "2. Run this command with the full path to the app:"
    echo "   xattr -cr /path/to/Video\\ Merger.app"
    exit 1
fi

# Remove quarantine attribute
echo "Removing quarantine attribute..."
xattr -cr "$APP_PATH"

if [ $? -eq 0 ]; then
    echo "✓ Success! The app should now open normally."
    echo ""
    echo "Try opening Video Merger from Applications now."
else
    echo "✗ Error: Failed to remove quarantine attribute"
    echo "You may need to run this with sudo:"
    echo "  sudo xattr -cr \"$APP_PATH\""
    exit 1
fi

