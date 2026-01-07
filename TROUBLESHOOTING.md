# Troubleshooting Guide

This guide helps you resolve common issues when using Video Merger.

## Table of Contents
- [Video Processing Errors](#video-processing-errors)
- [File and Permission Issues](#file-and-permission-issues)
- [Installation and Prerequisites](#installation-and-prerequisites)
- [Performance Issues](#performance-issues)
- [Getting Additional Help](#getting-additional-help)

---

## Video Processing Errors

### Invalid Video File
**Problem:** The video file appears to be corrupted or not in a valid format.

**Solutions:**
1. Try opening the file in QuickTime Player or VLC to verify it plays correctly
2. Re-download or re-copy the video file from the original source
3. Convert the file to MP4 format using a tool like HandBrake or FFmpeg
4. Check if the file extension matches the actual video format

### Unsupported Video Codec
**Problem:** The video uses a codec that FFmpeg doesn't support.

**Solutions:**
1. Convert the video to H.264 MP4 format (most widely supported)
2. Use HandBrake with the "Fast 1080p30" preset for conversion
3. Check the video codec using VLC: Tools > Media Information > Codec Details
4. For GoPro videos, ensure they weren't edited with proprietary software that changed the codec

### Operation Timed Out
**Problem:** Video processing took too long and was automatically stopped.

**Solutions:**
1. Process fewer videos at once
2. Split large video files into smaller segments first
3. Close other applications to free up system resources
4. Check Activity Monitor for high CPU/memory usage
5. Restart the app and try again with a smaller batch

### Invalid Video Duration
**Problem:** The video file has corrupted duration metadata.

**Solutions:**
1. Re-encode the video using HandBrake or FFmpeg to fix metadata
2. Try a different video file
3. For GoPro videos, ensure the recording wasn't interrupted mid-session

---

## File and Permission Issues

### File Not Found
**Problem:** The video file cannot be found at its original location.

**Solutions:**
1. Verify the file still exists in Finder
2. Check if the file was moved, renamed, or deleted
3. If the file was on an external drive, ensure the drive is connected
4. Try selecting the file again using the file picker
5. Copy the file to your Documents folder and try again

### Permission Denied
**Problem:** The app doesn't have permission to access the file or folder.

**Solutions:**
1. **Grant Full Disk Access** (recommended):
   - Open System Preferences > Privacy & Security
   - Click "Full Disk Access" in the sidebar
   - Click the lock to make changes
   - Click "+" and add Video Merger
   - Restart the app

2. **Check File Permissions**:
   - Right-click the file in Finder > Get Info
   - Expand "Sharing & Permissions"
   - Ensure you have "Read & Write" access

3. **Alternative Solutions**:
   - Copy the file to your Documents or Desktop folder
   - Make sure the file isn't open in another application
   - If the file is on a network drive, copy it locally first

### File Already Exists
**Problem:** A file with the same name already exists at the destination.

**Solutions:**
1. Choose a different filename pattern
2. Delete or rename the existing file
3. Select a different output folder
4. Add date/time tokens to your filename pattern for uniqueness

### Not Enough Disk Space
**Problem:** Insufficient free space to save the merged video.

**Solutions:**
1. Check available disk space: Apple menu > About This Mac > Storage
2. Delete unnecessary files or move them to external storage
3. Empty the Trash to reclaim space
4. Choose a different destination with more available space
5. For large merges, ensure you have at least 2x the size of all input videos

---

## Installation and Prerequisites

### FFmpeg Not Found
**Problem:** The video processing tool (FFmpeg) is not installed or accessible.

**Solutions:**
1. **Use Fat Build** (recommended):
   - Download the "fat" version of Video Merger which includes FFmpeg
   - No additional installation needed

2. **Install via App**:
   - Open Video Merger
   - Click "Install Prerequisites" when prompted
   - Wait for installation to complete

3. **Manual Installation**:
   ```bash
   # Install Homebrew (if not installed)
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   
   # Install FFmpeg
   brew install ffmpeg
   ```

4. **Verify Installation**:
   ```bash
   ffmpeg -version
   ffprobe -version
   ```

### Homebrew Issues
**Problem:** Homebrew is not installed or not working correctly.

**Solutions:**
1. Install Homebrew from https://brew.sh
2. After installation, run these commands to verify:
   ```bash
   brew --version
   brew doctor
   ```
3. If `brew doctor` reports issues, follow its suggestions to fix them

---

## Performance Issues

### Slow Processing
**Problem:** Video merging or splitting takes a very long time.

**Reasons and Solutions:**
1. **Large Video Files**:
   - This is normal for 4K or high-bitrate videos
   - Consider using lower resolution source files
   - Process in smaller batches

2. **System Resources**:
   - Close other applications
   - Check Activity Monitor for high CPU/memory usage
   - Ensure your Mac isn't thermal throttling (too hot)

3. **Storage Speed**:
   - Use SSD instead of HDD when possible
   - Avoid network drives for faster processing
   - Ensure output destination is on a fast drive

### App Crashes or Freezes
**Problem:** The app becomes unresponsive or crashes.

**Solutions:**
1. Restart the app and try again
2. Process fewer videos at once
3. Check Console.app for error messages
4. Update to the latest version of the app
5. Ensure macOS is up to date
6. If issue persists, report it on GitHub with error details

---

## Getting Additional Help

### Before Asking for Help
Please gather this information:
1. **macOS Version**: Apple menu > About This Mac
2. **App Version**: Video Merger > About
3. **Error Message**: Copy the full error text (including technical details)
4. **Steps to Reproduce**: What were you doing when the error occurred?
5. **Video Information**: 
   - File format and codec
   - File size
   - Number of files being processed

### Where to Get Help
1. **GitHub Issues**: https://github.com/jsartin513/graphic_video_editor/issues
   - Search existing issues first
   - Create a new issue with all relevant information
   - Include error messages and screenshots

2. **Check for Updates**:
   - Visit the releases page for the latest version
   - Review the changelog for recent bug fixes

3. **Enable Debug Logging**:
   - Open Console.app
   - Filter by "Video Merger" to see detailed logs
   - Include relevant logs when reporting issues

### Reporting Bugs
When creating a GitHub issue, please include:
- Clear description of the problem
- Steps to reproduce
- Expected vs. actual behavior
- Error messages (with technical details)
- System information
- Screenshots or screen recordings if applicable

---

## Quick Reference

| Error Code | Common Cause | Quick Fix |
|------------|--------------|-----------|
| FILE_NOT_FOUND | File moved or deleted | Re-select the file |
| PERMISSION_DENIED | No access permissions | Grant Full Disk Access |
| NO_SPACE | Insufficient disk space | Free up space or change destination |
| FFMPEG_NOT_FOUND | FFmpeg not installed | Use fat build or install FFmpeg |
| INVALID_FILE | Corrupted video | Re-download or convert file |
| TIMEOUT | Processing took too long | Process fewer files at once |

---

*Last updated: 2026-01-07*
