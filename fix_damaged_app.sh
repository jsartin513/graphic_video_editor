#!/bin/bash

# Fix "App is Damaged" error for Video Merger
# This removes the quarantine attribute that macOS adds to downloaded apps

APP_NAME="Video Merger.app"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_APP="$SCRIPT_DIR/$APP_NAME"
APPS_FOLDER_APP="/Applications/$APP_NAME"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Video Merger - Fix 'App is Damaged' Error"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check what's available
HAS_LOCAL=false
HAS_APPS=false

if [ -d "$LOCAL_APP" ]; then
    HAS_LOCAL=true
fi

if [ -d "$APPS_FOLDER_APP" ]; then
    HAS_APPS=true
fi

# If neither found, show error
if [ "$HAS_LOCAL" = false ] && [ "$HAS_APPS" = false ]; then
    echo "Error: $APP_NAME not found!"
    echo ""
    echo "Please ensure the app is in one of these locations:"
    echo "  1. Same folder as this script"
    echo "  2. /Applications/"
    echo ""
    echo "Or run manually:"
    echo "  xattr -cr /path/to/Video\\ Merger.app"
    exit 1
fi

# Function to fix the app
fix_app() {
    local APP_PATH="$1"
    local LOCATION="$2"
    
    echo ""
    echo "Fixing app at: $APP_PATH"
    echo ""
    
    xattr -cr "$APP_PATH"
    
    if [ $? -eq 0 ]; then
        echo "═══════════════════════════════════════════════════════════════"
        echo "  ✓ SUCCESS!"
        echo "═══════════════════════════════════════════════════════════════"
        echo ""
        if [ "$LOCATION" = "local" ]; then
            echo "The app is now fixed!"
            echo ""
            echo "Next steps:"
            echo "  1. Drag 'Video Merger.app' to your Applications folder"
            echo "  2. Open it from Applications"
        else
            echo "The app is now fixed!"
            echo ""
            echo "You can now open Video Merger from Applications."
        fi
        echo ""
        return 0
    else
        echo "═══════════════════════════════════════════════════════════════"
        echo "  ✗ ERROR"
        echo "═══════════════════════════════════════════════════════════════"
        echo ""
        echo "Failed to remove quarantine attribute."
        echo "Try running with sudo:"
        echo "  sudo xattr -cr \"$APP_PATH\""
        return 1
    fi
}

# If only one location has the app, fix it directly
if [ "$HAS_LOCAL" = true ] && [ "$HAS_APPS" = false ]; then
    echo "Found app in current folder."
    fix_app "$LOCAL_APP" "local"
    exit $?
fi

if [ "$HAS_LOCAL" = false ] && [ "$HAS_APPS" = true ]; then
    echo "Found app in Applications folder."
    fix_app "$APPS_FOLDER_APP" "apps"
    exit $?
fi

# Both locations have the app - let user choose
echo "App found in multiple locations!"
echo ""
echo "Choose which one to fix:"
echo ""
echo "  [1] Fix HERE (before moving to Applications)"
echo "      → $LOCAL_APP"
echo ""
echo "  [2] Fix in APPLICATIONS folder"
echo "      → $APPS_FOLDER_APP"
echo ""
echo "  [3] Fix BOTH"
echo ""
echo "  [q] Quit"
echo ""

read -p "Enter choice (1/2/3/q): " choice

case $choice in
    1)
        fix_app "$LOCAL_APP" "local"
        exit $?
        ;;
    2)
        fix_app "$APPS_FOLDER_APP" "apps"
        exit $?
        ;;
    3)
        echo ""
        echo "Fixing both locations..."
        fix_app "$LOCAL_APP" "local"
        result1=$?
        echo ""
        fix_app "$APPS_FOLDER_APP" "apps"
        result2=$?
        if [ $result1 -eq 0 ] && [ $result2 -eq 0 ]; then
            exit 0
        else
            exit 1
        fi
        ;;
    q|Q)
        echo "Cancelled."
        exit 0
        ;;
    *)
        echo "Invalid choice. Please run the script again."
        exit 1
        ;;
esac

