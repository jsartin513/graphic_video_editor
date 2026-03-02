/**
 * Video directory scanner - recursively finds video files in a directory
 */

const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./logger');

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.m4v'];

/**
 * Recursively scan a directory for video files
 * @param {string} dirPath - Directory path to scan
 * @param {string[]} [videoExtensions=VIDEO_EXTENSIONS] - Allowed video extensions
 * @returns {Promise<string[]>} Array of video file paths
 */
async function scanDirectoryForVideos(dirPath, videoExtensions = VIDEO_EXTENSIONS) {
  const videoFiles = [];

  async function scan(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (videoExtensions.includes(ext)) {
            videoFiles.push(fullPath);
          }
        }
      }
    } catch (error) {
      logger.error('Error scanning directory', { dirPath, error: error.message });
    }
  }

  await scan(dirPath);
  return videoFiles;
}

module.exports = {
  VIDEO_EXTENSIONS,
  scanDirectoryForVideos
};
