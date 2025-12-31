# FFmpeg Bundling Strategy

## Configurable Bundling

The build system now supports both bundled and lightweight builds via the `BUNDLE_FFMPEG` environment variable.

## Build Options

### Fat Build (with bundled ffmpeg) - Default
```bash
npm run build:fat          # Build both architectures with bundled ffmpeg
npm run build:fat:arm64    # Build Apple Silicon with bundled ffmpeg
npm run build:fat:x64      # Build Intel with bundled ffmpeg
```

### Lite Build (without bundled ffmpeg)
```bash
npm run build:lite         # Build both architectures without bundled ffmpeg
npm run build:lite:arm64   # Build Apple Silicon without bundled ffmpeg
npm run build:lite:x64     # Build Intel without bundled ffmpeg
```

### Default Build (bundles by default)
```bash
npm run build              # Defaults to bundling (same as build:fat)
npm run build:arm64
npm run build:x64
```

### Using Environment Variable Directly
```bash
BUNDLE_FFMPEG=true npm run build:arm64   # Bundle ffmpeg
BUNDLE_FFMPEG=false npm run build:arm64  # Don't bundle ffmpeg
```

## Runtime Behavior

The app uses a **smart hybrid approach** that checks for bundled binaries first, then falls back to system-installed ffmpeg. This gives us the best of both worlds:

1. **Bundled binaries checked first** - If included in the app, uses those (works out of the box)
2. **System binaries as fallback** - If bundled not found, uses system-installed ffmpeg (smaller app size)

### Benefits:
- ✅ Works out of the box for new users (bundled version)
- ✅ Smaller download for users who already have ffmpeg (can skip bundling)
- ✅ Flexible - users can choose their preferred ffmpeg version
- ✅ Backward compatible - existing users with system ffmpeg still work

## Alternative Approaches

### Option 1: Always Bundle (Fat Installer)
**Pros:**
- Simplest for end users
- No prerequisites needed
- Consistent experience

**Cons:**
- Large app size (~50-100MB larger)
- Licensing considerations (LGPL/GPL compliance)
- Slower downloads/updates

**Implementation:** Keep current code, always include binaries in build

### Option 2: Never Bundle (Lightweight)
**Pros:**
- Smallest app size
- Users can update ffmpeg independently
- No licensing concerns

**Cons:**
- Requires user to install ffmpeg separately
- More setup friction
- Can cause support issues

**Implementation:** Remove bundled binary code, rely only on system ffmpeg

### Option 3: Two Build Variants (Current + Alternative)
**Pros:**
- Users can choose
- Flexibility

**Cons:**
- More complex to maintain
- Confusing for users (which one do I download?)
- More build artifacts

**Implementation:** Build flag or separate build scripts

## Recommendation

**Stick with the current hybrid approach** because:

1. **It already supports both scenarios** - The code checks bundled first, then system
2. **No user confusion** - Single download that "just works"
3. **Flexibility** - Can bundle or not bundle based on your preference
4. **Backward compatible** - Existing users aren't affected

### To Control Bundling:

- **Bundle by default:** Keep current setup (binaries included)
- **Don't bundle:** Simply don't include the binaries in the build (remove from extraResources or skip the copy script)
- **Conditional bundling:** Add environment variable or build flag to control it

## Licensing Note

If you bundle ffmpeg, ensure compliance with LGPL/GPL licensing:
- Include license notices
- Provide source code access if required
- Consider your app's license compatibility

For most use cases, LGPL is fine for bundling in commercial apps as long as you follow the license terms.

