# Builds and Releases Documentation

This document captures important lessons learned about building and releasing the Video Merger Electron app, including FAT builds, cross-compilation, GitHub Actions workflows, and troubleshooting.

## Table of Contents

1. [Build Types](#build-types)
2. [FAT Builds and Cross-Compilation](#fat-builds-and-cross-compilation)
3. [FFmpeg Binary Bundling](#ffmpeg-binary-bundling)
4. [GitHub Actions Release Workflow](#github-actions-release-workflow)
5. [Troubleshooting](#troubleshooting)
6. [Best Practices](#best-practices)

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

