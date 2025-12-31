# How to Download Builds from GitHub

## Finding Your Builds

After the GitHub Actions workflow completes, you can find the built applications in two places:

### Option 1: GitHub Actions Artifacts (Recommended)

1. Go to your GitHub repository
2. Click on the **"Actions"** tab
3. Find the workflow run you want (usually the most recent one)
4. Click on the workflow run to see the jobs
5. You'll see four jobs:
   - **build-x64-fat** - Intel Mac builds (with bundled ffmpeg)
   - **build-x64-lite** - Intel Mac builds (without bundled ffmpeg)
   - **build-arm64-fat** - Apple Silicon builds (with bundled ffmpeg)
   - **build-arm64-lite** - Apple Silicon builds (without bundled ffmpeg)
6. Click on any job to see the artifacts
7. Under "Artifacts", you'll see:
   - **Video-Merger-x64-fat** - Intel (x64) with bundled ffmpeg
   - **Video-Merger-x64-lite** - Intel (x64) without bundled ffmpeg
   - **Video-Merger-arm64-fat** - Apple Silicon (arm64) with bundled ffmpeg
   - **Video-Merger-arm64-lite** - Apple Silicon (arm64) without bundled ffmpeg
8. Click on the artifact name to download it as a ZIP file
9. Extract the ZIP to get the DMG files

### Option 2: GitHub Releases (If you created a tag)

1. Go to your GitHub repository
2. Click on **"Releases"** (on the right sidebar)
3. Find the release version you want
4. Download the files directly:
   - Files with `-x64-fat` or `-x64-lite` are for Intel Macs
   - Files with `-arm64-fat` or `-arm64-lite` are for Apple Silicon Macs
   - Files with `-fat` include bundled ffmpeg (recommended)
   - Files with `-lite` require system-installed ffmpeg

## Which File Do I Need?

### For Intel Macs (x64)

**Fat Build (Recommended - includes ffmpeg):**
- Download: `Video Merger-1.0.0-x64-fat.dmg` or `Video Merger-1.0.0-x64-fat-mac.zip`
- Includes bundled ffmpeg - no installation needed
- Larger file size (~50-100MB more)

**Lite Build (requires system ffmpeg):**
- Download: `Video Merger-1.0.0-x64-lite.dmg` or `Video Merger-1.0.0-x64-lite-mac.zip`
- Smaller file size
- Requires: `brew install ffmpeg` (if not already installed)

### For Apple Silicon Macs (arm64)

**Fat Build (Recommended - includes ffmpeg):**
- Download: `Video Merger-1.0.0-arm64-fat.dmg` or `Video Merger-1.0.0-arm64-fat-mac.zip`
- Includes bundled ffmpeg - no installation needed
- Larger file size (~50-100MB more)

**Lite Build (requires system ffmpeg):**
- Download: `Video Merger-1.0.0-arm64-lite.dmg` or `Video Merger-1.0.0-arm64-lite-mac.zip`
- Smaller file size
- Requires: `brew install ffmpeg` (if not already installed)

### How to Check Your Mac Type
1. Click the Apple menu → **About This Mac**
2. Look for:
   - **"Chip"** showing "Apple M1", "Apple M2", "Apple M3", etc. → Use **arm64** version
   - **"Processor"** showing "Intel Core" → Use **x64** version

## Troubleshooting

### "No files found" Error in GitHub Actions

If you see a warning about no files being found:
1. Check the build logs to see if the build actually completed
2. Look for the "Rename x64 files" step - it should show what files were renamed
3. The files should be renamed to include `-x64` in the name

### Files Not Showing Up

1. Make sure the workflow completed successfully (green checkmark)
2. Artifacts are only available for completed workflow runs
3. Artifacts expire after 30 days (as configured in the workflow)
4. For permanent downloads, create a GitHub Release by pushing a version tag

## Creating a Release for Permanent Downloads

To make builds permanently available:

```bash
# Create a version tag
git tag v1.0.0
git push origin v1.0.0
```

This will trigger the release job and create a GitHub Release with all four build variants attached (fat and lite for both architectures).

