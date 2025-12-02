# Distribution Guide

## For End Users

### System Requirements

- macOS 10.13 or later
- ffmpeg installed on the system

### Installing Prerequisites

**Easy Method**: Run the installation script:

```bash
# Download or navigate to the Video Editor directory
cd /path/to/video-editor

# Run the prerequisites installer
./install_prerequisites.sh
```

This script will:
- Check if Homebrew is installed (and install it if needed)
- Install ffmpeg if it's not already installed
- Verify that everything is working correctly

**Manual Method**: If you prefer to install manually:

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install ffmpeg
brew install ffmpeg
```

**Quick Check**: To verify prerequisites without installing:

```bash
./check_prerequisites.sh
```

### Installing the App

1. Download the DMG file
2. Open the DMG file
3. Drag "Video Editor" to your Applications folder
4. Open the app from Applications

### First Launch - "App is Damaged" Error

**Important**: If you see an error saying the app is "damaged" or "can't be opened", this is macOS Gatekeeper blocking unsigned apps. Here's how to fix it:

**Method 1: Right-click to Open (Easiest)**
1. Right-click (or Control-click) on "Video Merger.app"
2. Select "Open" from the context menu
3. Click "Open" in the security dialog that appears
4. The app will now open normally

**Method 2: Remove Quarantine Attribute (Automated)**
1. Download the `fix_damaged_app.sh` script from the repository
2. Open Terminal and run:
   ```bash
   bash fix_damaged_app.sh
   ```
3. Then try opening the app normally

**Method 2b: Remove Quarantine Attribute (Manual)**
1. Open Terminal
2. Run this command:
   ```bash
   xattr -cr /Applications/Video\ Merger.app
   ```
3. Then try opening the app normally

**Method 3: System Settings**
1. Go to System Settings > Privacy & Security
2. Scroll down to find the message about Video Merger being blocked
3. Click "Open Anyway"
4. Confirm by clicking "Open" in the dialog

**Why this happens**: The app is not code-signed with an Apple Developer certificate. This is normal for apps distributed outside the App Store. The app is safe to use - macOS just needs your explicit permission the first time.

## For Developers

### Building the App

```bash
npm install
npm run build
```

The built files will be in the `dist/` directory.

### Code Signing (Optional)

To code-sign the app for distribution without security warnings, you'll need:

1. An Apple Developer account
2. Code signing certificates
3. Update the `build.mac.identity` in `package.json`

See [electron-builder documentation](https://www.electron.build/code-signing) for details.

