# How to View Console Logs from the Video Merger App

When the app is installed from a GitHub Actions build, you can view console logs to debug FFmpeg issues. Here are several methods:

## Method 1: Launch from Terminal (Easiest)

1. Open Terminal (Applications > Utilities > Terminal)
2. Navigate to the app location (usually `/Applications/`):
   ```bash
   cd /Applications
   ```
3. Launch the app from Terminal:
   ```bash
   open "Video Merger.app"
   ```
   OR directly:
   ```bash
   "/Applications/Video Merger.app/Contents/MacOS/Video Merger"
   ```
4. The console output will appear in the Terminal window

## Method 2: Use macOS Console App

1. Open **Console** app (Applications > Utilities > Console)
2. In the left sidebar, look for your Mac's name
3. In the search box, type: `Video Merger` or `ffmpeg` or `getBundledBinaryPath`
4. Launch the Video Merger app
5. The logs will appear in real-time in Console

## Method 3: View Logs from System Logs

1. Open Terminal
2. Run this command to view recent logs:
   ```bash
   log show --predicate 'process == "Video Merger"' --last 5m --style compact
   ```
3. Or to follow logs in real-time:
   ```bash
   log stream --predicate 'process == "Video Merger"' --level debug
   ```

## Method 4: Check App's Log File (if it creates one)

Some Electron apps write logs to a file. Check:
- `~/Library/Logs/Video Merger/`
- `~/Library/Application Support/Video Merger/logs/`

## What to Look For

When the app starts, you should see logs like:
```
[getBundledBinaryPath] Looking for ffmpeg at: /Applications/Video Merger.app/Contents/Resources/resources/ffmpeg
[getBundledBinaryPath] resourcesPath: /Applications/Video Merger.app/Contents/Resources
[getBundledBinaryPath] process.resourcesPath: ...
[getBundledBinaryPath] app.getPath('resources'): ...
```

If you see:
- `❌ ffmpeg not found at ...` - The path resolution is wrong
- `Contents of resourcesPath: [...]` - Shows what's actually in the Resources directory
- `✅ Found ffmpeg: ...` - Success! The binary was found

## Quick Test Command

To quickly test if the app can find ffmpeg, run this in Terminal after launching the app:

```bash
# Check if binaries exist in the app bundle
ls -lh "/Applications/Video Merger.app/Contents/Resources/resources/"
file "/Applications/Video Merger.app/Contents/Resources/resources/ffmpeg"
```

## If You Can't See Logs

If you're not seeing console output:

1. **Make sure the app is actually running** - Check Activity Monitor
2. **Try launching from Terminal** (Method 1) - This is the most reliable
3. **Check if the app has a "View Logs" menu option** - Some Electron apps include this
4. **Enable verbose logging** - The app may need to be rebuilt with more verbose logging enabled

## Sharing Logs

When reporting issues, please share:
1. The full console output from when the app launches
2. Any error messages related to ffmpeg
3. The output of the "Quick Test Command" above

This will help identify exactly where the path resolution is failing.

