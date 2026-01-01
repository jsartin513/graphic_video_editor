// Formatting utility functions (CommonJS for easy testing)

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Number of bytes to format
 * @returns {string} Formatted string (e.g., "1.5 MB")
 */
function formatBytes(bytes) {
  // Handle invalid inputs: null, undefined, NaN, non-numbers, zero, or negative
  if (!bytes || bytes === 0 || isNaN(bytes) || typeof bytes !== 'number' || bytes < 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1 // Cap at the maximum size unit (GB)
  );
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

module.exports = { formatBytes };

