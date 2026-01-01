# Build vs Install Requirements

## Important Distinction

There are **two different scenarios** with different requirements:

### 1. Building the App (Developer/CI)
**Requires Node.js** ✅

- Running `npm install` to get dependencies
- Running `npm run build` to create the DMG/ZIP files
- Copying ffmpeg binaries from npm packages
- This happens **once** on a development machine or CI server

**Requirements:**
- Node.js (v14+)
- npm
- macOS (for building Mac apps)

### 2. Installing/Running the App (End Users)
**Does NOT require Node.js** ✅

- Users download the DMG file
- They drag the app to Applications
- They run the app
- The bundled ffmpeg binaries are **standalone executables** that work without Node.js

**Requirements:**
- macOS 10.13+
- **No Node.js needed!**
- **No npm needed!**
- **No command-line tools needed!**

## How It Works

### During Build (Developer Side):
```bash
# Developer runs this (needs Node.js):
npm install              # Downloads ffmpeg-static, ffprobe-static packages
npm run build:fat        # Copies binaries to resources/ folder
                         # Electron-builder packages everything into DMG
```

### During Install (User Side):
```bash
# User just:
1. Downloads Video Merger.dmg
2. Opens DMG
3. Drags app to Applications
4. Runs the app

# Everything is already included:
# - Electron runtime (includes Node.js)
# - Your app code
# - Bundled ffmpeg binary (standalone executable)
# - Bundled ffprobe binary (standalone executable)
```

## The Bundled Binaries

The `ffmpeg-static` and `ffprobe-static` npm packages contain **pre-compiled binary executables** for different platforms. These are:

- ✅ Standalone executables (don't require Node.js to run)
- ✅ Platform-specific (Mac, Windows, Linux)
- ✅ Self-contained (include all necessary libraries)
- ✅ Already compiled (no compilation needed)

When you build the app:
1. The npm packages are used to **locate** the binary files
2. The binaries are **copied** to the `resources/` folder
3. Electron-builder **includes** them in the packaged app
4. Users get the binaries **already bundled** in the DMG

## Comparison

| Scenario | Node.js Required? | npm Required? | Command Line Required? |
|----------|------------------|---------------|----------------------|
| **Building the app** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Installing the app** | ❌ No | ❌ No | ❌ No |
| **Running the app** | ❌ No | ❌ No | ❌ No |

## For End Users

Users who download your app:

✅ **DO get:**
- The Video Merger app (ready to use)
- Bundled ffmpeg and ffprobe binaries (if fat build)
- Everything they need in one DMG file

❌ **DO NOT need:**
- Node.js
- npm
- Homebrew
- Command-line knowledge
- To install anything separately (if using fat build)

## For Lite Builds

If you distribute a **lite build** (without bundled ffmpeg):

Users would need to install ffmpeg separately:
```bash
brew install ffmpeg  # Requires Homebrew and command-line access
```

That's why **fat builds are recommended** for distribution - users don't need anything else!


