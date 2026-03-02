# Auto-Update Testing Guide

## Test Scenarios

### 1. Basic Functionality Tests

#### ✅ Test: Auto-check on startup (production only)
- **Steps**: 
  1. Build production app: `npm run build:arm64`
  2. Install and launch the app
  3. Check console for update check (should happen after 3 seconds)
- **Expected**: Update check runs automatically, no user notification if up-to-date

#### ✅ Test: Manual update check
- **Steps**:
  1. In app, open DevTools console
  2. Run: `window.electronAPI.checkForUpdates()`
- **Expected**: Either shows "Up to date" message or error if offline

#### ✅ Test: Development mode doesn't check
- **Steps**:
  1. Run `npm start` (development mode)
  2. Check console - should NOT see update checks
- **Expected**: No update checking in development

### 2. Error Handling Tests

#### ✅ Test: Network failure during check
- **Steps**:
  1. Disconnect internet
  2. Manually check for updates
- **Expected**: Shows user-friendly error about internet connection

#### ✅ Test: Download failure
- **Steps**:
  1. Trigger update download
  2. Disconnect internet mid-download
- **Expected**: Shows error message, allows retry

#### ✅ Test: Missing version info
- **Steps**: Test with incomplete update info object
- **Expected**: Gracefully handles missing version fields

### 3. Edge Cases

#### ✅ Test: Multiple rapid checks
- **Steps**: 
  1. Rapidly click "Check for Updates" multiple times
- **Expected**: Only one check runs at a time (prevents race conditions)

#### ✅ Test: Multiple download attempts
- **Steps**:
  1. Start download
  2. Try to download again while in progress
- **Expected**: Second attempt is ignored (download state flag)

#### ✅ Test: Progress with missing data
- **Steps**: Test progress callback with undefined/null values
- **Expected**: Progress bar handles missing data gracefully

#### ✅ Test: Install without download
- **Steps**: Try to install update before downloading
- **Expected**: electron-updater handles this (won't work, but won't crash)

### 4. UI Tests

#### ✅ Test: Notification dismissal
- **Steps**:
  1. Get update notification
  2. Click "Remind Me Later" or close
- **Expected**: Notification animates out and is removed

#### ✅ Test: Multiple notifications
- **Steps**:
  1. Trigger update notification
  2. Trigger another notification
- **Expected**: Old notification is removed before showing new one

#### ✅ Test: Progress display
- **Steps**:
  1. Start download
  2. Watch progress bar
- **Expected**: Progress updates smoothly, shows percentage and file sizes

### 5. Integration Tests

#### ✅ Test: Update with existing work
- **Steps**:
  1. Have files selected in app
  2. Download and install update
- **Expected**: User can choose "Install on Quit" to finish work first

#### ✅ Test: Update during merge operation
- **Steps**:
  1. Start a video merge
  2. Update becomes available
- **Expected**: Update doesn't interrupt merge, can install after

### 6. Build & Release Tests

#### ✅ Test: latest-mac.yml generation
- **Steps**:
  1. Run `npm run build:arm64`
  2. Check `dist/latest-mac.yml` exists
- **Expected**: File is generated with update metadata

#### ✅ Test: Publish config (should NOT publish)
- **Steps**:
  1. Build without `PUBLISH_TO_GITHUB=true`
  2. Verify no publishing attempt
- **Expected**: Build succeeds, no publish errors

#### ✅ Test: Workflow includes latest-mac.yml
- **Steps**:
  1. Check GitHub Actions workflow
  2. Verify artifacts include `latest-mac.yml`
- **Expected**: Workflow uploads update metadata files

### 7. Security Tests

#### ✅ Test: XSS prevention
- **Steps**: Check all dynamic content uses `textContent`
- **Expected**: No `innerHTML` with user/update data

#### ✅ Test: HTTPS only
- **Steps**: Verify update downloads use HTTPS
- **Expected**: All GitHub release URLs use HTTPS

## Manual Testing Checklist

- [ ] App starts without errors in development
- [ ] App starts without errors in production build
- [ ] Auto-check runs 3 seconds after startup (production only)
- [ ] Update notification appears when update available
- [ ] Download progress displays correctly
- [ ] Install options work (restart now vs on quit)
- [ ] Error messages are user-friendly
- [ ] Multiple rapid actions don't cause issues
- [ ] Notification can be dismissed
- [ ] Version information displays correctly
- [ ] Works offline (graceful error handling)

## Automated Tests (Future)

Consider adding unit tests for:
- `formatBytes()` function with edge cases
- Version comparison logic
- Error message formatting
- Progress calculation with missing data

