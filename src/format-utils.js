// Formatting utility functions (CommonJS for easy testing)

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Number of bytes to format
 * @param {Object} [options] - Formatting options
 * @param {boolean} [options.singularByte] - Use "1 Byte" instead of "1 Bytes" when bytes === 1
 * @returns {string} Formatted string (e.g., "1.5 MB")
 */
function formatBytes(bytes, options = {}) {
  // Handle invalid inputs: null, undefined, NaN, non-numbers, zero, or negative
  if (!bytes || bytes === 0 || isNaN(bytes) || typeof bytes !== 'number' || bytes < 0) {
    return '0 Bytes';
  }
  if (bytes === 1 && options.singularByte) {
    return '1 Byte';
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

