# Distribution Guide for Non-Technical Users

## Best Way to Share with Friends

### Option 1: GitHub Releases (Recommended) ⭐

**This is the easiest option!** Create a GitHub Release and share a simple link.

#### Step 1: Create a Release

After merging your PR and when ready to release:

```bash
# Make sure you're on main branch and up to date
git checkout main
git pull origin main

# Create and push a version tag (e.g., v1.0.0)
git tag v1.0.0
git push origin v1.0.0
```

**That's it!** GitHub Actions will automatically:
- Build all versions (x64 and arm64, fat and lite)
- Create a GitHub Release
- Attach all download files to the release

#### Step 2: Share the Link

Share this link with your friends:
```
https://github.com/jsartin513/graphic_video_editor/releases/latest
```

Or for a specific version:
```
https://github.com/jsartin513/graphic_video_editor/releases/tag/v1.0.0
```

#### Step 3: Simple Instructions for Your Friends

Send them this:

---

**Hey! Here's the Video Merger app:**

📥 **Download:** https://github.com/jsartin513/graphic_video_editor/releases/latest

**Which file to download?**

1. **Check your Mac type:**
   - Click the 🍎 Apple menu → "About This Mac"
   - See "Chip: Apple M1/M2/M3"? → Download the **arm64-fat** file
   - See "Processor: Intel"? → Download the **x64-fat** file

2. **Download the `.dmg` file** (it's easier than the zip)

3. **Install:**
   - Open the downloaded `.dmg` file
   - Drag "Video Merger" to your Applications folder
   - Open it from Applications

4. **If it says "App is damaged":**
   - Open Terminal (Applications > Utilities > Terminal)
   - Copy and paste this command:
     ```bash
     xattr -cr "/Applications/Video Merger.app"
     ```
   - Press Enter
   - Try opening the app again

**That's it!** The app includes everything needed - no extra software to install.

---

### Option 2: Direct Download Links

You can also share direct download links to specific files:

```
# For Intel Macs (fat build - recommended)
https://github.com/jsartin513/graphic_video_editor/releases/download/v1.0.0/Video-Merger-1.0.0-x64-fat.dmg

# For Apple Silicon Macs (fat build - recommended)
https://github.com/jsartin513/graphic_video_editor/releases/download/v1.0.0/Video-Merger-1.0.0-arm64-fat.dmg
```

Replace `v1.0.0` with your actual version tag.

### Option 3: Create a Simple Landing Page

For the most user-friendly experience, you could create a simple webpage that:
- Detects the user's Mac type
- Shows a "Download" button that links to the correct file
- Includes installation instructions

But GitHub Releases is probably the easiest option!

## Auto-Updates (Future Enhancement)

If you want the app to automatically notify users about updates:

1. The app already has auto-update code in place
2. You'll need to enable it in `electron-builder.config.js` by setting the `publish` option
3. Users will then see update notifications in the app when new versions are released

## Versioning Tips

Use semantic versioning:
- **v1.0.0** - First stable release
- **v1.1.0** - New features, backward compatible
- **v1.0.1** - Bug fixes
- **v2.0.0** - Breaking changes

## Quick Release Checklist

Before creating a release:

- [ ] All tests pass
- [ ] PR is merged to main
- [ ] Version number updated in `package.json` (if needed)
- [ ] Changelog/notes prepared (optional but helpful)
- [ ] Tag created and pushed: `git tag v1.0.0 && git push origin v1.0.0`

That's it! GitHub Actions does the rest automatically.

