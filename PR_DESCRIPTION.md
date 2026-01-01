# Configurable FFmpeg Bundling with Fat and Lite Builds

## Summary

This PR adds configurable ffmpeg bundling, allowing builds with or without bundled ffmpeg binaries. The GitHub Actions pipeline now builds both fat (with bundled ffmpeg) and lite (without bundled ffmpeg) versions for each architecture.

## Changes

### Core Features
- ✅ Add `ffmpeg-static` and `ffprobe-static` npm packages for bundling
- ✅ Create copy script that respects `BUNDLE_FFMPEG` environment variable
- ✅ Add `electron-builder.config.js` with conditional resource inclusion
- ✅ Update app to check for bundled binaries first, then fall back to system ffmpeg

### Build Scripts
- ✅ Add `build:fat` and `build:lite` variants for all architectures
- ✅ Default builds bundle ffmpeg (backward compatible)

### CI/CD
- ✅ Update GitHub Actions to build 4 variants:
  - `build-x64-fat` (Intel with bundled ffmpeg)
  - `build-x64-lite` (Intel without bundled ffmpeg)
  - `build-arm64-fat` (Apple Silicon with bundled ffmpeg)
  - `build-arm64-lite` (Apple Silicon without bundled ffmpeg)
- ✅ Update release job to include all variants

### Bug Fixes
- ✅ Fix ffmpeg PATH issues for packaged apps
- ✅ Update app name references from "Video Editor" to "Video Merger"

### Documentation
- ✅ Add `BUILD_OPTIONS.md` - guide for build variants
- ✅ Add `BUILD_VS_INSTALL.md` - clarifies Node.js requirements
- ✅ Add `BUNDLING_STRATEGY.md` - bundling strategy explanation
- ✅ Add `TEST_BUILD_PROCESS.md` - testing instructions
- ✅ Update `HOW_TO_DOWNLOAD_BUILDS.md` - reflects new build variants
- ✅ Update `README.md` and `DISTRIBUTION.md`

## Testing

- ✅ Verified copy script works with `BUNDLE_FFMPEG=true` and `BUNDLE_FFMPEG=false`
- ✅ Verified electron-builder config conditionally includes resources
- ✅ Verified build scripts exist and are properly configured
- ✅ Code review completed - all logic verified

## Breaking Changes

None - default behavior bundles ffmpeg (same as before).

## Usage Examples

```bash
# Fat build (with bundled ffmpeg) - Recommended
npm run build:fat:arm64

# Lite build (without bundled ffmpeg)
npm run build:lite:arm64

# Using environment variable
BUNDLE_FFMPEG=false npm run build:arm64
```

## Next Steps

After merging:
1. GitHub Actions will automatically build all 4 variants
2. Users can choose fat (bundled) or lite (smaller) builds
3. Releases will include all variants


