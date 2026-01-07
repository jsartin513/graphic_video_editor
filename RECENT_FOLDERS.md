# Recent Folders Feature

The Recent Folders feature provides quick access to directories you've recently used, improving productivity when working with the same folders repeatedly.

## Overview

When working with video files, you often need to access the same folders multiple times. The Recent Folders feature remembers your recently accessed directories and provides one-click access to reload files from those locations.

## How It Works

### Automatic Tracking

The app automatically tracks directories whenever you:
- Select files using the "Select Files" button
- Select a folder using the "Select Folder" button
- Drag and drop files or folders into the app

The directory containing your selected files is added to the recent list, limited to the 10 most recent locations.

### Accessing Recent Folders

Recent folders appear in a dedicated section at the top of the main screen, just below the file selection buttons. Each folder entry shows:
- 📂 Folder icon (or 📌 for pinned folders)
- Folder name
- Parent path (for context)
- Pin/unpin button

Simply click on any folder to load all video files from that location.

### Pinning Folders

Pin your most frequently used folders to keep them at the top of the list:

1. Click the 📌 button next to any recent folder
2. The folder moves to the pinned section and displays with a 📌 icon
3. Pinned folders persist across app restarts and won't be removed when the recent list is cleared

To unpin a folder, click the 📍 button.

### Managing Recent Folders

**Clear Recent Folders:**
Click the "Clear" button in the Recent Folders header to remove all recent (non-pinned) folders. Pinned folders are preserved.

**Automatic Cleanup:**
The app automatically removes folders that no longer exist (e.g., deleted or unmounted drives) when:
- The app starts
- You try to open a folder that doesn't exist

## Technical Details

### Storage

Recent and pinned folders are stored in the app's preferences file, located at:
```
~/Library/Application Support/video-editor/preferences.json
```

### Data Structure

Each folder entry contains:
- `path`: Full path to the directory
- `lastUsed`: ISO timestamp of when it was last accessed (for recent folders)
- `pinnedAt`: ISO timestamp of when it was pinned (for pinned folders)

### Limits

- **Recent Folders**: Maximum of 10 (configurable via `maxRecentDirectories` preference)
- **Pinned Folders**: No limit
- **Total Display**: Shows all pinned folders plus up to 10 recent folders

### Privacy

All recent folder data is stored locally on your machine. The app never transmits this information to any external services. You can clear recent folders at any time, and pinned folders can be individually unpinned.

## Keyboard Navigation

The Recent Folders section is fully keyboard accessible:
- **Tab**: Navigate between folder items
- **Enter/Space**: Open selected folder
- **Tab**: Move to pin/unpin button
- **Enter/Space**: Toggle pin state

## Examples

### Workflow Example

1. You select videos from `/Users/john/Videos/Vacation2024/`
2. The folder appears in Recent Folders
3. Later, you need more videos from the same folder
4. Click on the folder in Recent Folders to instantly load all videos
5. Pin the folder if you'll use it frequently

### Pinning Example

If you regularly work with videos in these folders:
- `/Users/john/Videos/GoPro/`
- `/Users/john/Videos/Projects/`
- `/Volumes/ExternalDrive/Footage/`

Pin all three to keep them always accessible, even if you work with other folders in between.

## Troubleshooting

**Folder shows but won't open:**
- The folder may have been deleted or moved
- Try clearing recent folders to trigger automatic cleanup
- Check that the folder still exists and is accessible

**Recent folders not appearing:**
- Make sure you've selected files or folders at least once
- Check that the folder paths are valid
- Restart the app to reload preferences

**Too many folders in the list:**
- Click "Clear" to remove all non-pinned folders
- Unpin folders you no longer need
- The list automatically maintains the 10 most recent entries

## Related Features

- **Filename Preferences**: See [FILENAME_PREFERENCES.md](FILENAME_PREFERENCES.md)
- **Video Grouping**: Automatic grouping of GoPro session files
- **Drag and Drop**: Direct file and folder dropping
