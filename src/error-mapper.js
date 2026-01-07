/**
 * Error Mapper Module
 * Maps technical FFmpeg errors to user-friendly messages with actionable suggestions
 */

/**
 * Common FFmpeg error patterns and their user-friendly mappings
 */
const ERROR_MAPPINGS = [
  {
    pattern: /no such file or directory|cannot find|file not found/i,
    userMessage: "File Not Found",
    suggestion: "The video file could not be found. It may have been moved, renamed, or deleted.",
    fixes: [
      "Check if the file still exists in its original location",
      "Try selecting the file again",
      "Make sure the file hasn't been moved to another folder"
    ],
    code: "FILE_NOT_FOUND"
  },
  {
    pattern: /invalid data found|invalid argument|invalid|malformed/i,
    userMessage: "Invalid Video File",
    suggestion: "The file appears to be corrupted or not a valid video format.",
    fixes: [
      "Try opening the file in another video player to verify it works",
      "Re-download or re-copy the video file",
      "Convert the file to a standard format (MP4, MOV) using another tool"
    ],
    code: "INVALID_FILE"
  },
  {
    pattern: /permission denied|access denied|eacces/i,
    userMessage: "Permission Denied",
    suggestion: "The app doesn't have permission to access this file or folder.",
    fixes: [
      "Check the file/folder permissions in Finder",
      "Make sure the file isn't open in another application",
      "Try copying the file to your Documents folder",
      "Grant the app full disk access in System Preferences > Privacy & Security"
    ],
    code: "PERMISSION_DENIED"
  },
  {
    pattern: /no space left|disk full|enospc/i,
    userMessage: "Not Enough Disk Space",
    suggestion: "There isn't enough free space on your disk to complete this operation.",
    fixes: [
      "Free up disk space by deleting unnecessary files",
      "Choose a different destination folder with more space",
      "Empty your Trash to reclaim disk space"
    ],
    code: "NO_SPACE"
  },
  {
    pattern: /codec.*not found|unknown codec|unsupported codec/i,
    userMessage: "Unsupported Video Codec",
    suggestion: "The video uses a codec that isn't supported.",
    fixes: [
      "Try converting the video to H.264 (MP4) format first",
      "Use a different video file",
      "Check if the video plays correctly in QuickTime or VLC"
    ],
    code: "UNSUPPORTED_CODEC"
  },
  {
    pattern: /timed out|timeout/i,
    userMessage: "Operation Timed Out",
    suggestion: "The video processing took too long and was stopped.",
    fixes: [
      "Try processing fewer or smaller video files at once",
      "Check if your Mac is running other heavy applications",
      "Restart the app and try again"
    ],
    code: "TIMEOUT"
  },
  {
    pattern: /already exists|file exists|eexist/i,
    userMessage: "File Already Exists",
    suggestion: "A file with this name already exists at the destination.",
    fixes: [
      "Choose a different filename",
      "Delete or rename the existing file",
      "Select a different output folder"
    ],
    code: "FILE_EXISTS"
  },
  {
    pattern: /broken pipe|connection reset|epipe/i,
    userMessage: "Processing Interrupted",
    suggestion: "The video processing was unexpectedly interrupted.",
    fixes: [
      "Try the operation again",
      "Restart the app if the problem persists",
      "Check if your Mac has enough available memory"
    ],
    code: "INTERRUPTED"
  },
  {
    pattern: /not found|enoent.*ffmpeg|cannot find.*ffmpeg/i,
    userMessage: "FFmpeg Not Found",
    suggestion: "The video processing tool (FFmpeg) is not installed or accessible.",
    fixes: [
      "Use the 'Install Prerequisites' button in the app",
      "Download and install Homebrew from https://brew.sh",
      "Manually install FFmpeg: brew install ffmpeg"
    ],
    code: "FFMPEG_NOT_FOUND"
  },
  {
    pattern: /duration.*invalid|invalid duration/i,
    userMessage: "Invalid Video Duration",
    suggestion: "The video file has an invalid or corrupted duration.",
    fixes: [
      "Try re-encoding the video with another tool first",
      "Check if the video plays correctly in QuickTime",
      "Use a different video file"
    ],
    code: "INVALID_DURATION"
  }
];

/**
 * Map a technical error to a user-friendly error object
 * @param {Error|string} error - The original error
 * @returns {Object} Mapped error with user-friendly information
 */
function mapError(error) {
  const errorMessage = typeof error === 'string' ? error : error.message || String(error);
  
  // Try to match against known patterns
  for (const mapping of ERROR_MAPPINGS) {
    if (mapping.pattern.test(errorMessage)) {
      return {
        userMessage: mapping.userMessage,
        suggestion: mapping.suggestion,
        fixes: mapping.fixes,
        code: mapping.code,
        technicalDetails: errorMessage,
        originalError: error
      };
    }
  }
  
  // Default fallback for unknown errors
  return {
    userMessage: "An Unexpected Error Occurred",
    suggestion: "Something went wrong while processing your video.",
    fixes: [
      "Try the operation again",
      "Restart the app if the problem continues",
      "Check the technical details below for more information"
    ],
    code: "UNKNOWN_ERROR",
    technicalDetails: errorMessage,
    originalError: error
  };
}

/**
 * Format an error for display in the console
 * @param {Object} mappedError - The mapped error object
 * @returns {string} Formatted error string
 */
function formatErrorForLog(mappedError) {
  return `[${mappedError.code}] ${mappedError.userMessage}: ${mappedError.suggestion}`;
}

module.exports = {
  mapError,
  formatErrorForLog,
  ERROR_MAPPINGS
};
