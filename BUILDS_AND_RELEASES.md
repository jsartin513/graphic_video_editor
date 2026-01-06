# Builds and Releases Documentation

This document captures important lessons learned about building and releasing the Video Merger Electron app, including FAT builds, cross-compilation, GitHub Actions workflows, and troubleshooting.

## Table of Contents

1. [Build Types](#build-types)
2. [FAT Builds and Cross-Compilation](#fat-builds-and-cross-compilation)
3. [FFmpeg Binary Bundling](#ffmpeg-binary-bundling)
4. [GitHub Actions Release Workflow](#github-actions-release-workflow)
5. [Testing Strategy](#testing-strategy)
6. [Auto-Update Configuration](#auto-update-configuration)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Build Types

### FAT vs Lite Builds

**FAT Builds** (Recommended):
- Include bundled FFmpeg and FFprobe binaries (~75MB each)
- Work out-of-the-box - no installation needed
- Larger file size (~150MB+ more than lite)
- Build scripts: `build:fat:x64`, `build:fat:arm64`, `build:fat`

**Lite Builds**:
- Do not include FFmpeg binaries
- Require users to have FFmpeg installed (`brew install ffmpeg`)
- Smaller file size
- Build scripts: `build:x64`, `build:arm64`

### Architecture Builds

- **x64 (Intel)**: For Intel-based Macs
- **arm64 (Apple Silicon)**: For M1/M2/M3 Macs

## FAT Builds and Cross-Compilation

### Overview

FAT builds bundle FFmpeg binaries so users don't need to install them separately. This is especially important for cross-compilation scenarios (e.g., building x64 binaries on an Apple Silicon Mac).

### Key Components

1. **`scripts/copy-ffmpeg-binaries.js`**:
   - Detects target architecture from `TARGET_ARCH` environment variable or npm script name
   - If target matches host: Uses locally installed `ffmpeg-static` package
   - If target differs (cross-compile): Downloads correct binaries from GitHub releases
   - Handles gzip decompression (even after HTTP redirects)
   - Validates binary size and architecture

2. **`scripts/after-pack.js`** (Electron Builder hook):
   - Workaround for `extraResources` not reliably copying binaries
   - Manually copies binaries from `resources/` to app bundle
   - Also copies test videos to `test-videos/` directory
   - Sets executable permissions on binaries

3. **Build Scripts**:
   ```json
   "build:fat:x64": "BUNDLE_FFMPEG=true electron-builder --mac --x64 --config.afterPack=scripts/after-pack.js"
   "build:fat:arm64": "BUNDLE_FFMPEG=true electron-builder --mac --arm64 --config.afterPack=scripts/after-pack.js"
   ```

### Cross-Compilation Process

1. **Set TARGET_ARCH environment variable**:
   ```bash
   TARGET_ARCH=x64 npm run prebuild:x64
   ```

2. **Prebuild script downloads correct binaries**:
   - Checks if `TARGET_ARCH` matches `process.arch`
   - If different, downloads from GitHub releases:
     - URL: `https://github.com/eugeneware/ffmpeg-static/releases/download/v{version}/ffmpeg-{os}-{arch}.gz`
     - Decompresses gzipped files

3. **AfterPack hook ensures binaries are bundled**:
   - Copies from `resources/` to `.app/Contents/Resources/resources/`
   - Sets executable permissions

### Why afterPack Hook?

`electron-builder`'s `extraResources` configuration is not always reliable, especially for cross-compiled builds. The `afterPack` hook ensures binaries are copied regardless of `extraResources` behavior.

## FFmpeg Binary Bundling

### Path Resolution

The app uses `process.resourcesPath` (set by Electron) to locate bundled binaries:

```
/Applications/video-editor.app/Contents/Resources/resources/ffmpeg
/Applications/video-editor.app/Contents/Resources/resources/ffprobe
```

### Finding Bundled Binaries (`main.js`)

The `getBundledBinaryPath()` function:
1. Uses `process.resourcesPath` directly (most reliable)
2. Falls back to `app.getPath('resources')` if needed
3. Checks `resources/resources/{binaryName}` path
4. Validates file exists before returning

**Important**: Do NOT call `app.getPath('resources')` inside console.log statements - it can throw errors. Wrap in try-catch if logging.

### Runtime Detection

The `checkFFmpeg()` function:
1. Gets bundled binary path
2. Tests executability using `spawn(binaryPath, ['-version'])`
3. Extracts version from output
4. Falls back to system binary if bundled not found

**Why direct spawn?**: Using `which` doesn't work for non-PATH binaries.

## GitHub Actions Release Workflow

### Triggering Releases

Releases are created automatically on:
1. **Push to main/master**: Creates a **prerelease** with tag like `v{run_number}-{sha}`
2. **Tag push** (e.g., `v1.0.0`): Creates a **full release** with the tag name

### Workflow Structure

```yaml
jobs:
  # Build jobs (run in parallel)
  build-x64-fat:
  build-x64-lite:
  build-arm64-fat:
  build-arm64-lite:
  
  # Release job (waits for all builds)
  release:
    needs: [build-x64-fat, build-x64-lite, build-arm64-fat, build-arm64-lite]
    if: startsWith(github.ref, 'refs/tags/v') || github.ref == 'refs/heads/main'
    permissions:
      contents: write  # Required!
      id-token: write
```

### Required Permissions

**Critical**: The release job MUST have `contents: write` permission, otherwise you'll get:
```
Error: Resource not accessible by integration
```

Add to the release job:
```yaml
permissions:
  contents: write
  id-token: write
```

### File Patterns

**Problem**: ZIP files may not always be created, causing pattern matching failures.

**Solution**: Use wildcard patterns and don't fail on missing files:

```yaml
files: |
  artifacts/**/*.dmg
  artifacts/**/*.zip
fail_on_unmatched_files: false
```

### Dynamic Release Names

Releases from pushes vs tags need different naming:

```yaml
- name: Determine release tag and name
  run: |
    if [[ "${{ github.ref }}" == refs/tags/* ]]; then
      # Tag push: Use tag name
      TAG_NAME="${{ github.ref_name }}"
      RELEASE_NAME="Release ${{ github.ref_name }}"
      IS_PRERELEASE="false"
    else
      # Push to main: Use run number + SHA
      TAG_NAME="v${{ github.run_number }}-${{ github.sha }}"
      RELEASE_NAME="Build from main (${{ github.sha }} - Run #${{ github.run_number }})"
      IS_PRERELEASE="true"
    fi
```

## Testing Strategy

### Jest Setup

The project uses Jest for unit testing. Tests are located in `__tests__/` directory.

**Configuration**: Jest is configured in `package.json` with defaults that work well for Node.js modules.

**Test Scripts**:
```json
"test": "jest",
"test:watch": "jest --watch"
```

### Test Structure

Tests are organized in the `__tests__/` directory:

```
__tests__/
  └── video-grouping.test.js   # Tests for src/video-grouping.js
```

**Note**: Additional test files can be added as needed (e.g., `format-utils.test.js` for formatting utilities).

### Writing Tests

**Example Test File** (`__tests__/video-grouping.test.js`):

```javascript
const { extractSessionId, analyzeAndGroupVideos } = require('../src/video-grouping');
const path = require('path');

describe('extractSessionId', () => {
  test('extracts session ID from GX pattern', () => {
    expect(extractSessionId('GX010001.MP4')).toBe('0001');
  });

  test('returns null for non-GoPro files', () => {
    expect(extractSessionId('video.mp4')).toBeNull();
  });
});

describe('analyzeAndGroupVideos', () => {
  test('groups files by session ID from same directory', () => {
    const filePaths = [
      '/videos/folder1/GX010001.MP4',
      '/videos/folder1/GX020001.MP4',
    ];
    const result = analyzeAndGroupVideos(filePaths);
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe('0001');
  });
});
```

### Testing Patterns

1. **Test Pure Functions**: Focus on pure functions that are easy to test
   - Example: `extractSessionId`, `formatBytes`, `analyzeAndGroupVideos`

2. **Extract Testable Code**: Extract business logic from Electron-specific code
   - `src/video-grouping.js` - extracted from `main.js` for testability
   - `src/format-utils.js` - extracted for reusability and testing

3. **Test Edge Cases**: Cover edge cases and error conditions
   - Invalid inputs (null, undefined, empty strings)
   - Boundary conditions
   - Different file naming patterns

4. **Use Descriptive Test Names**: Test names should clearly describe what they're testing
   - ✅ Good: `'groups files by session ID from same directory'`
   - ❌ Bad: `'test 1'`

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (reruns on file changes)
npm run test:watch

# Run specific test file
npm test video-grouping.test.js

# Run with coverage
npm test -- --coverage
```

### What to Test

**✅ Good candidates for testing:**
- Pure functions (no side effects)
- Business logic (video grouping, session ID extraction)
- Utility functions (formatting, validation)
- Data transformations

**❌ Harder to test (avoid initially):**
- Electron IPC handlers (requires mocking Electron APIs)
- File system operations (requires test fixtures)
- UI interactions (requires rendering tests)

### Test Best Practices

1. **Keep tests simple and focused** - One assertion per test when possible
2. **Use descriptive names** - Test names should read like documentation
3. **Test behavior, not implementation** - Test what the function does, not how
4. **Mock external dependencies** - Don't rely on actual file system or network
5. **Test edge cases** - Null, undefined, empty strings, boundary values
6. **Run tests before commits** - Catch issues early

### Example: Testing Format Utilities

```javascript
const { formatBytes } = require('../src/format-utils');

describe('formatBytes', () => {
  test('formats zero bytes', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
  });

  test('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 Bytes');
  });

  test('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  test('handles invalid input', () => {
    expect(formatBytes(null)).toBe('0 Bytes');
    expect(formatBytes(undefined)).toBe('0 Bytes');
    expect(formatBytes(NaN)).toBe('0 Bytes');
  });
});
```

## Auto-Update Configuration

### Overview

The app has `electron-updater` installed and basic infrastructure, but auto-updates are currently disabled in production builds. This section explains how to enable them.

### Current Status

- ✅ `electron-updater` package installed
- ✅ Basic IPC handlers in place
- ✅ UI notification system ready
- ❌ Auto-updates disabled (`app.isPackaged` check prevents running in production)
- ❌ Release metadata not being generated

### Prerequisites

1. **GitHub Releases**: Auto-updates require GitHub Releases with proper metadata
2. **Code Signing** (Recommended): Unsigned apps may have issues on macOS
3. **Release Metadata**: Electron Builder needs to generate `latest-mac.yml` files

### Enabling Auto-Updates

#### Step 1: Update `electron-builder.config.js`

```javascript
const baseConfig = {
  // ... existing config ...
  publish: {
    provider: 'github',
    owner: 'jsartin513',
    repo: 'graphic_video_editor',
    releaseType: 'release'
  }
};
```

**Note**: You can make this conditional:
```javascript
publish: process.env.PUBLISH_TO_GITHUB === 'true' ? {
  provider: 'github',
  // ... config ...
} : null
```

#### Step 2: Generate Update Metadata

Electron Builder automatically generates `latest-mac.yml` when publishing. Ensure your GitHub Actions workflow:

1. Uploads `latest-mac.yml` files as artifacts
2. Includes them in the release

Example workflow step:
```yaml
- name: Upload update metadata
  uses: actions/upload-artifact@v4
  with:
    name: latest-mac-yml
    path: dist/latest-mac.yml
```

#### Step 3: Enable in `main.js`

Remove or modify the `app.isPackaged` check:

```javascript
// Current (disabled):
if (app.isPackaged) {
  autoUpdater.checkForUpdatesAndNotify();
}

// To enable:
autoUpdater.checkForUpdatesAndNotify();
```

#### Step 4: Configure Update Checks

```javascript
const { autoUpdater } = require('electron-updater');

// Check for updates on app startup (if enabled)
if (app.isPackaged && process.env.NODE_ENV === 'production') {
  // Check immediately
  autoUpdater.checkForUpdatesAndNotify();
  
  // Then check every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 4 * 60 * 60 * 1000);
}
```

### Update Flow

1. **Check for Updates**: App calls `autoUpdater.checkForUpdatesAndNotify()`
2. **Download**: If update available, downloads in background
3. **Notify User**: Shows notification when download completes
4. **Install**: User clicks "Install Update" → App quits and installs
5. **Restart**: App restarts with new version

### IPC Handlers (Already Implemented)

The app already has IPC handlers for manual update checks:

```javascript
// In main.js
ipcMain.handle('check-for-updates', async () => {
  return await autoUpdater.checkForUpdatesAndNotify();
});

// In preload.js
checkForUpdates: () => ipcRenderer.invoke('check-for-updates')
```

### UI Integration

The renderer has `updateNotification.js` module that:
- Shows update available notifications
- Displays download progress
- Provides install/restart buttons

### Security Considerations

1. **Code Signing**: Required for auto-updates on macOS
   - Get Apple Developer account ($99/year)
   - Sign app with Developer ID certificate
   - Notarize with Apple

2. **HTTPS Only**: Updates must be served over HTTPS (GitHub Releases provides this)

3. **Verify Updates**: Electron-updater verifies update signatures automatically

### Testing Auto-Updates

**Option 1: Local Testing**
1. Build app with version 1.0.0
2. Create release on GitHub
3. Build app with version 1.0.1
4. Install 1.0.0 version
5. It should detect and download 1.0.1

**Option 2: Beta Channel**
- Use prereleases for testing
- Configure auto-updater to check prereleases

### Troubleshooting

**Updates not detected:**
- Check `latest-mac.yml` is in release
- Verify publish configuration in `electron-builder.config.js`
- Check network connectivity
- Review console logs for errors

**"Update not available" when it should be:**
- Check version numbers (must be higher)
- Verify release is published (not draft)
- Check `latest-mac.yml` format is correct

**Download fails:**
- Check file permissions
- Verify disk space
- Check network connectivity

### Current Recommendation

**Keep auto-updates disabled** until:
1. App is code-signed
2. Release process is stable
3. You want automatic distribution

**For now**: Users can manually download from GitHub Releases page.

## Troubleshooting

### "FFmpeg not found" Errors

1. **Check if binaries are bundled**:
   ```bash
   ls -lh "/Applications/video-editor.app/Contents/Resources/resources/"
   ```

2. **Check logs** - Look for:
   - `[getBundledBinaryPath] Looking for ffmpeg at: ...`
   - `[getBundledBinaryPath] ✅ Found ffmpeg` or `❌ not found`

3. **Verify architecture**:
   ```bash
   file "/Applications/video-editor.app/Contents/Resources/resources/ffmpeg"
   # Should show correct architecture (x86_64 or arm64)
   ```

4. **Check afterPack hook ran**: Look for `[afterPack]` logs in build output

### "Resource not accessible by integration" Error

**Cause**: Missing permissions in release job

**Fix**: Add to release job:
```yaml
permissions:
  contents: write
```

### Pattern Matching Failures in Releases

**Error**: `Pattern 'artifacts/arm64-fat/*.zip' does not match any files`

**Cause**: ZIP files may not be created, or paths don't match exactly

**Fix**:
1. Use wildcards: `artifacts/**/*.dmg` and `artifacts/**/*.zip`
2. Add `fail_on_unmatched_files: false`
3. Add debugging step to list actual files

### Cross-Compilation Binary Download Issues

**Problem**: Binaries not downloading correctly

**Check**:
1. `TARGET_ARCH` environment variable is set correctly
2. Release tag is correct in `copy-ffmpeg-binaries.js`
3. Gzip decompression is working (check download logs)

**Common issues**:
- GitHub redirects causing decompression to fail - solution: track if original URL was gzipped
- Wrong architecture - verify `file` command output

### App Hanging on Startup

**Check**:
1. Console logs for IPC errors (e.g., `getFileMetadata` receiving undefined)
2. FFmpeg path resolution logs
3. Any errors in Terminal when launching from command line

**Common fixes**:
- Ensure IPC handlers receive all required parameters
- Validate parameters before processing
- Add error handling and logging

## Best Practices

### Build Scripts

1. **Always set TARGET_ARCH** explicitly in GitHub Actions:
   ```yaml
   env:
     TARGET_ARCH: 'x64'  # or 'arm64'
   ```

2. **Use afterPack hook** for FAT builds:
   ```bash
   --config.afterPack=scripts/after-pack.js
   ```

3. **Verify binaries exist** before building:
   ```bash
   if [ ! -f resources/ffmpeg ]; then
     echo "❌ Error: FFmpeg binary not found"
     exit 1
   fi
   ```

### Release Workflow

1. **Always add permissions** to release job
2. **Use wildcards** for file patterns
3. **Add debugging steps** to list artifacts before creating release
4. **Test locally** with `npm run verify-build` if available

### Testing

1. **Test bundled binaries locally**:
   ```bash
   npm run verify-fat-build  # If available
   ```

2. **Check app logs** from Terminal:
   ```bash
   "/Applications/video-editor.app/Contents/MacOS/video-editor"
   ```

3. **Verify architecture**:
   ```bash
   file /path/to/binary
   ```

### Distribution

1. **Tag releases** for stable versions: `git tag v1.0.0 && git push origin v1.0.0`
2. **Pushes to main** create prereleases for testing
3. **Share release links**: `https://github.com/owner/repo/releases/latest`
4. **Include installation instructions** for non-technical users

## Key Files Reference

- **`scripts/copy-ffmpeg-binaries.js`**: Downloads/copies FFmpeg binaries
- **`scripts/after-pack.js`**: Electron Builder hook to bundle binaries and test videos
- **`main.js`**: Runtime binary path resolution (`getBundledBinaryPath`)
- **`.github/workflows/build.yml`**: CI/CD workflow
- **`electron-builder.config.js`**: Build configuration

## Common Bugs and Fixes

### IPC Handler Parameter Issues

**Bug**: `getFileMetadata` IPC handler receiving `undefined` parameter
- **Symptoms**: App hangs or crashes on startup, errors in console about invalid path arguments
- **Cause**: `preload.js` not passing parameters to IPC calls
- **Fix**: Ensure all IPC handlers pass their parameters:
  ```javascript
  // ❌ Wrong
  getFileMetadata: (filePath) => ipcRenderer.invoke('get-file-metadata'),
  
  // ✅ Correct
  getFileMetadata: (filePath) => ipcRenderer.invoke('get-file-metadata', filePath),
  ```
- **Prevention**: Always validate IPC parameters in handlers before processing

### macOS Metadata Files Breaking FFmpeg

**Bug**: FFmpeg fails with "Impossible to open '._GX014166.MP4'"
- **Symptoms**: Merge operations fail, FFmpeg errors about invalid input files
- **Cause**: macOS creates hidden metadata files (starting with `._`) when copying to external drives
- **Fix**: Filter out metadata files before creating FFmpeg file lists:
  ```javascript
  const validFilePaths = filePaths.filter(filePath => {
    const filename = path.basename(filePath);
    return !filename.startsWith('._');
  });
  ```
- **Prevention**: Always filter `._` files when processing file lists for external tools

### Electron `app` Object Undefined

**Bug**: `TypeError: Cannot read properties of undefined (reading 'whenReady')`
- **Symptoms**: App crashes immediately on startup
- **Cause**: Electron installation corrupted or module shadowing
- **Fix**: Reinstall `node_modules`:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```
- **Prevention**: Use `npm ci` in CI/CD to ensure clean installs

### Path Resolution Errors

**Bug**: `app.getPath('resources')` throwing errors when logged
- **Symptoms**: App crashes with path-related errors
- **Cause**: Calling Electron APIs inside console.log without error handling
- **Fix**: Wrap in try-catch or avoid logging Electron APIs directly:
  ```javascript
  // ❌ Wrong
  console.log(`Path: ${app.getPath('resources')}`);
  
  // ✅ Correct
  try {
    const resourcesPath = app.getPath('resources');
    console.log(`Path: ${resourcesPath}`);
  } catch (e) {
    console.log(`Path: Error - ${e.message}`);
  }
  ```
- **Prevention**: Always wrap Electron API calls in try-catch blocks

### Merge Operation Hangs

**Bug**: Video merge operations hang indefinitely
- **Symptoms**: App appears frozen during merge, no progress updates
- **Causes**: 
  1. FFmpeg waiting for input that never comes
  2. No timeout set on spawn operations
  3. Missing error handling for FFmpeg stderr
- **Fix**: 
  1. Add timeout to FFmpeg operations
  2. Log FFmpeg stderr in real-time
  3. Validate file paths before starting merge
- **Prevention**: Always add timeouts and logging to external process spawns

## Lessons Learned

1. **`extraResources` is unreliable** - Use `afterPack` hook for critical resources
2. **`process.resourcesPath` is most reliable** - Don't rely on `app.getPath('resources')` alone
3. **Permissions matter** - Always set `contents: write` for release jobs
4. **Wildcards are safer** - Specific file patterns break easily
5. **Debug logging is essential** - Add extensive logging for path resolution
6. **Validate IPC parameters** - Always check for undefined/null before processing
7. **Filter metadata files** - macOS creates `._` files that break FFmpeg
8. **Test cross-compilation** - Verify binaries match target architecture
9. **Wrap Electron APIs in try-catch** - Especially when logging
10. **Add timeouts to external processes** - Prevent infinite hangs
11. **Test IPC handlers thoroughly** - Parameter passing is easy to miss
12. **Log stderr from external processes** - Critical for debugging FFmpeg issues

