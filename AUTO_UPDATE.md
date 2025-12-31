# Auto-Update Feature

The Video Merger app includes automatic update checking and installation using electron-updater.

## How It Works

### For End Users

1. **Automatic Check on Startup**: When you open the app, it automatically checks for new versions
2. **Update Notification**: If a new version is available, a notification appears at the top of the window
3. **Download Update**: Click "Download Update" to download the new version in the background
4. **Install Options**: 
   - **Restart & Install**: Immediately quit and install the update
   - **Install on Quit**: The update will be installed the next time you quit the app

### What Happens Behind the Scenes

- The app checks the GitHub releases page for new versions
- Updates are only checked in production builds (not during development)
- The update is downloaded in the background without interrupting your work
- After download, you choose when to install (now or later)
- Updates are digitally verified before installation

## For Developers

### Release Process

1. **Tag a new version**: Create a git tag with version number (e.g., `v1.1.0`)
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

2. **GitHub Actions builds**: The workflow automatically builds all variants (x64/arm64, fat/lite)

3. **Release created**: A GitHub release is created with all build artifacts

4. **Auto-update metadata**: electron-builder generates `latest-mac.yml` with update information

5. **Users get notified**: Apps in the field check this file and notify users of updates

### Configuration

The auto-update feature is configured in:

- **electron-builder.config.js**: Sets up the publish provider (GitHub)
- **main.js**: Configures auto-updater behavior and event handlers
- **preload.js**: Exposes update API to renderer
- **updateNotification.js**: Handles the UI for update notifications

### Testing Updates

To test the auto-update feature:

1. Create a production build: `npm run build`
2. Install the built app
3. Increment version in package.json
4. Create another build and GitHub release
5. Open the first installed version - it should detect the update

**Note**: Auto-updates only work in packaged production builds, not in development mode.

### Customization

You can customize the update behavior in `main.js`:

```javascript
autoUpdater.autoDownload = false;  // Don't auto-download, ask user first
autoUpdater.autoInstallOnAppQuit = true;  // Install on quit if downloaded
```

### Security

- Updates are downloaded over HTTPS
- GitHub releases are signed
- electron-updater verifies signatures before installation
- Only works with releases from the configured repository

## Troubleshooting

### Update check fails

- Ensure you have an internet connection
- Check that GitHub releases exist for your repository
- Verify the publish configuration in electron-builder.config.js

### Update doesn't install

- Make sure the app has write permissions
- Check that the downloaded update is complete
- Look for errors in the console logs

### Updates not detected

- Verify that package.json version is incremented
- Ensure the GitHub release has the latest-mac.yml file
- Check that the release is not marked as draft or pre-release
