# Build Options Guide

## Configurable FFmpeg Bundling

The build system supports two build variants: **Fat** (with bundled ffmpeg) and **Lite** (without bundled ffmpeg).

## Build Commands

### Fat Builds (With Bundled FFmpeg)
Includes ffmpeg and ffprobe binaries in the app. **Recommended for most users.**

```bash
npm run build:fat          # Build both architectures (arm64 + x64)
npm run build:fat:arm64    # Build Apple Silicon only
npm run build:fat:x64      # Build Intel only
```

**Pros:**
- ✅ Works out of the box - no prerequisites
- ✅ Consistent experience for all users
- ✅ No setup required

**Cons:**
- ⚠️ Larger file size (~50-100MB larger)
- ⚠️ Slower download/update

### Lite Builds (Without Bundled FFmpeg)
Requires users to have ffmpeg installed on their system.

```bash
npm run build:lite         # Build both architectures (arm64 + x64)
npm run build:lite:arm64   # Build Apple Silicon only
npm run build:lite:x64     # Build Intel only
```

**Pros:**
- ✅ Smaller file size
- ✅ Users can use their preferred ffmpeg version
- ✅ Faster downloads

**Cons:**
- ⚠️ Users must install ffmpeg separately
- ⚠️ Setup required: `brew install ffmpeg`

### Default Builds (Bundles by Default)
The default build commands bundle ffmpeg (same as `build:fat`):

```bash
npm run build              # Build both architectures (bundles ffmpeg)
npm run build:arm64        # Build Apple Silicon (bundles ffmpeg)
npm run build:x64          # Build Intel (bundles ffmpeg)
```

## Using Environment Variables

You can also control bundling via the `BUNDLE_FFMPEG` environment variable:

```bash
BUNDLE_FFMPEG=true npm run build:arm64   # Bundle ffmpeg
BUNDLE_FFMPEG=false npm run build:arm64  # Don't bundle ffmpeg
```

## Runtime Behavior

Regardless of build type, the app uses a smart hybrid approach:

1. **First**: Checks for bundled binaries (if included)
2. **Fallback**: Uses system-installed ffmpeg (if available)
3. **Error**: Shows helpful message if neither is found

This means:
- **Fat builds**: Always work (uses bundled ffmpeg)
- **Lite builds**: Work if user has system ffmpeg installed
- **Both**: Can use system ffmpeg even if bundled version exists (if user prefers)

## Which Build Should I Use?

### For Distribution (Recommended):
**Use Fat Builds** - Most users want a "just works" experience without setup.

### For Development/Testing:
**Use Lite Builds** if:
- You already have ffmpeg installed
- You want smaller builds for testing
- You want to test system ffmpeg integration

## GitHub Actions

The GitHub Actions workflow bundles ffmpeg by default. To change this, set a repository variable `BUNDLE_FFMPEG` to `false` in your GitHub repository settings.

