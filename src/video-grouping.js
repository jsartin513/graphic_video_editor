/**
 * Video Grouping Module
 * Extracts and groups GoPro video files by session ID and directory
 */

const path = require('path');

/**
 * Extract session ID from GoPro filename
 * Supports: GX010001, GXAA0123 (letters), GP010001, GOPR0001
 * @param {string} filename - The filename (e.g., "GX010001.MP4" or "GXAA0123.MP4")
 * @returns {string|null} - The 4-digit session ID or null if not a GoPro file
 */
function extractSessionId(filename) {
  // Pattern: GX??????.MP4 -> extract last 4 digits (GX + 2 alphanumeric + 4 digits)
  // Covers GX010001, GXAA0123, GX01ABCD, etc.
  const gxMatch = filename.match(/GX[A-Z0-9]{2}(\d{4})\.MP4$/i);
  if (gxMatch) return gxMatch[1];
  
  // Pattern: GP??????.MP4 -> extract last 4 digits
  const gpMatch = filename.match(/GP[A-Z0-9]{2}(\d{4})\.MP4$/i);
  if (gpMatch) return gpMatch[1];
  
  // Pattern: GOPR????.MP4 -> extract 4 digits
  const goprMatch = filename.match(/GOPR(\d{4})\.MP4$/i);
  if (goprMatch) return goprMatch[1];
  
  return null;
}

/**
 * Derive a filename pattern from a GoPro filename for output suggestions
 * e.g. "GXAA0123.MP4" -> "GXAA{sessionId}", "GOPR0001.MP4" -> "GOPR{sessionId}"
 * @param {string} filename - The filename (e.g., "GXAA0123.MP4")
 * @returns {string|null} - A pattern with {sessionId} placeholder, or null
 */
function derivePatternFromFilename(filename) {
  const sessionId = extractSessionId(filename);
  if (!sessionId) return null;
  const base = filename.replace(/\.MP4$/i, '');
  // The sessionId is always the last 4 characters of the base; use slice to avoid
  // replacing an earlier occurrence of the same digit sequence in the prefix.
  const prefix = base.slice(0, -sessionId.length);
  return `${prefix}{sessionId}`;
}

/**
 * Analyze and group video files by session ID and directory
 * Files from different subdirectories with the same session ID are processed separately
 * @param {string[]} filePaths - Array of file paths to analyze
 * @returns {Array} - Array of grouped video objects with sessionId, directory, files, and outputFilename
 */
function analyzeAndGroupVideos(filePaths) {
  const groups = new Map();
  if (!Array.isArray(filePaths)) return [];

  for (const filePath of filePaths) {
    const filename = path.basename(filePath);
    const sessionId = extractSessionId(filename);
    
    if (!sessionId) {
      // Skip files that don't match GoPro patterns
      continue;
    }
    
    // Group by directory path AND session ID to handle files with same name in different directories
    const directory = path.dirname(filePath);
    const groupKey = `${directory}:${sessionId}`;
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        sessionId,
        directory,
        files: []
      });
    }
    
    groups.get(groupKey).files.push(filePath);
  }
  
  // Sort files within each group and create result objects
  const result = [];
  for (const [groupKey, groupData] of groups.entries()) {
    const sortedFiles = groupData.files.sort();
    
    // For display, use session ID. If multiple directories have the same session ID,
    // include directory name in the output filename to differentiate
    const hasDuplicateSessionId = Array.from(groups.values())
      .filter(g => g.sessionId === groupData.sessionId).length > 1;
    
    let outputFilename = `PROCESSED${groupData.sessionId}.MP4`;
    if (hasDuplicateSessionId) {
      // Include directory name to differentiate files from different directories
      const dirName = path.basename(groupData.directory) || 'root';
      // Sanitize directory name for filename (remove invalid chars)
      const sanitizedDirName = dirName.replace(/[^a-zA-Z0-9_-]/g, '_');
      outputFilename = `PROCESSED${groupData.sessionId}_${sanitizedDirName}.MP4`;
    }
    
    result.push({
      sessionId: groupData.sessionId,
      directory: groupData.directory,
      files: sortedFiles,
      outputFilename
    });
  }
  
  // Sort by directory first, then by session ID
  result.sort((a, b) => {
    const dirCompare = a.directory.localeCompare(b.directory);
    if (dirCompare !== 0) return dirCompare;
    return a.sessionId.localeCompare(b.sessionId);
  });
  
  return result;
}

module.exports = {
  extractSessionId,
  derivePatternFromFilename,
  analyzeAndGroupVideos
};


