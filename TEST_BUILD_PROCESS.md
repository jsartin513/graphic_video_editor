# Testing the Build Process

## Quick Test Checklist

Run these commands to test the new configurable build process:

### 1. Install Dependencies
```bash
npm install
```

This should install `ffmpeg-static` and `ffprobe-static` packages.

### 2. Test Lite Build (No Bundling)

```bash
# Test the copy script with bundling disabled
BUNDLE_FFMPEG=false node scripts/copy-ffmpeg-binaries.js

# Verify resources directory is removed/doesn't exist
ls resources/ 2>&1
# Should show: "No such file or directory" or similar

# Test electron-builder config
node -e "const config = require('./electron-builder.config.js'); console.log('extraResources:', config.extraResources.length)"
# Should show: extraResources: 0
```

### 3. Test Fat Build (With Bundling)

```bash
# Test the copy script with bundling enabled
BUNDLE_FFMPEG=true node scripts/copy-ffmpeg-binaries.js

# Verify resources directory exists with binaries
ls -lh resources/
# Should show: ffmpeg and ffprobe files

# Verify binaries are executable
file resources/ffmpeg
file resources/ffprobe
# Should show: "Mach-O" or "executable"

# Test electron-builder config
node -e "const config = require('./electron-builder.config.js'); console.log('extraResources:', config.extraResources.length)"
# Should show: extraResources: 1
```

### 4. Test Build Scripts

```bash
# Test fat build script (should bundle)
npm run build:fat:arm64
# Check dist/ for output files

# Test lite build script (should not bundle)
npm run build:lite:arm64
# Check dist/ for output files (should be smaller)
```

### 5. Automated Test Script

```bash
# Run the automated test script
node scripts/test-build-process.js
```

## Expected Results

### Lite Build:
- ✅ No `resources/` directory
- ✅ Smaller app size
- ✅ App will use system ffmpeg (if installed)
- ✅ `electron-builder.config.js` has empty `extraResources`

### Fat Build:
- ✅ `resources/` directory exists
- ✅ Contains `ffmpeg` and `ffprobe` binaries
- ✅ Binaries are executable
- ✅ Larger app size (~50-100MB more)
- ✅ App will use bundled ffmpeg
- ✅ `electron-builder.config.js` includes `extraResources`

## Troubleshooting

### If `ffmpeg-static` or `ffprobe-static` are not found:
```bash
npm install ffmpeg-static ffprobe-static
```

### If copy script fails:
- Check that packages are installed: `npm list ffmpeg-static ffprobe-static`
- Verify Node.js version: `node --version` (should be v14+)

### If electron-builder config fails:
- Check that `electron-builder.config.js` exists
- Verify it exports a valid config object

