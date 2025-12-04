# How to Download Builds from GitHub

## Finding Your Builds

After the GitHub Actions workflow completes, you can find the built applications in two places:

### Option 1: GitHub Actions Artifacts (Recommended)

1. Go to your GitHub repository
2. Click on the **"Actions"** tab
3. Find the workflow run you want (usually the most recent one)
4. Click on the workflow run to see the jobs
5. You'll see two jobs:
   - **build-x64** - Intel Mac builds
   - **build-arm64** - Apple Silicon builds
6. Click on either job to see the artifacts
7. Under "Artifacts", you'll see:
   - **Video-Editor-x64** - Contains the Intel (x64) DMG and ZIP files
   - **Video-Editor-arm64** - Contains the Apple Silicon (arm64) DMG and ZIP files
8. Click on the artifact name to download it as a ZIP file
9. Extract the ZIP to get the DMG files

### Option 2: GitHub Releases (If you created a tag)

1. Go to your GitHub repository
2. Click on **"Releases"** (on the right sidebar)
3. Find the release version you want
4. Download the files directly:
   - Files with `-x64` in the name are for Intel Macs
   - Files with `-arm64` in the name are for Apple Silicon Macs

## Which File Do I Need?

### For Intel Macs (x64)
- Download: `Video Merger-1.0.0-x64.dmg` or `Video Merger-1.0.0-x64-mac.zip`
- These files have `-x64` in the filename

### For Apple Silicon Macs (arm64)
- Download: `Video Merger-1.0.0-arm64.dmg` or `Video Merger-1.0.0-arm64-mac.zip`
- These files have `-arm64` in the filename

### How to Check Your Mac Type
1. Click the Apple menu → **About This Mac**
2. Look for:
   - **"Chip"** showing "Apple M1", "Apple M2", "Apple M3", etc. → Use **arm64** version
   - **"Processor"** showing "Intel Core" → Use **x64** version

## Installing the App

⚠️ **IMPORTANT**: This app is not code-signed, so macOS will block it by default.

### Using the ZIP File (Recommended)

1. Download the `.zip` file for your Mac type
2. Extract the ZIP - you'll see:
   - `Video Merger.app` - the application
   - `fix_damaged_app.sh` - the fix script
   - `README_FIRST.txt` - installation instructions
3. **Run the fix script FIRST**: Double-click `fix_damaged_app.sh` (or run `bash fix_damaged_app.sh` in Terminal)
4. Drag `Video Merger.app` to your Applications folder
5. Open and enjoy!

### Using the DMG File

1. Download the `.dmg` file for your Mac type
2. Open the DMG and drag the app to Applications
3. If you get "App is Damaged" error, open Terminal and run:
   ```bash
   xattr -cr /Applications/Video\ Merger.app
   ```
4. Try opening the app again

See `INSTALLATION_TROUBLESHOOTING.md` for more detailed help.

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

This will trigger the release job and create a GitHub Release with both builds attached.

