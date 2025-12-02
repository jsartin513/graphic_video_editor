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

### First Launch

On first launch, macOS may show a security warning because the app is not code-signed. To allow it:

1. Go to System Preferences > Security & Privacy
2. Click "Open Anyway" next to the message about Video Editor
3. Or right-click the app and select "Open"

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

