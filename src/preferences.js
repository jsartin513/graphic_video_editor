/**
 * User Preferences Module
 * Manages storage and retrieval of user preferences for file naming patterns and date formats
 */

const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

// Get preferences file path (in user data directory)
function getPreferencesPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'preferences.json');
}

// Default preferences
const DEFAULT_PREFERENCES = {
  recentFilenamePatterns: [],
  maxRecentPatterns: 10,
  preferredDateFormat: 'YYYY-MM-DD', // ISO format by default
  lastUsedPattern: null,
  preferredQuality: 'copy', // Default to copy (fastest, no re-encoding)
  dateFormats: [
    { name: 'ISO (YYYY-MM-DD)', format: 'YYYY-MM-DD' },
    { name: 'US (MM-DD-YYYY)', format: 'MM-DD-YYYY' },
    { name: 'European (DD-MM-YYYY)', format: 'DD-MM-YYYY' },
    { name: 'Compact (YYYYMMDD)', format: 'YYYYMMDD' }
  ],
  failedOperations: [] // Track failed merge operations for recovery
};

/**
 * Load user preferences from disk
 * @returns {Promise<Object>} The preferences object
 */
async function loadPreferences() {
  try {
    const prefsPath = getPreferencesPath();
    const data = await fs.readFile(prefsPath, 'utf8');
    const prefs = JSON.parse(data);
    
    // Merge with defaults to ensure all keys exist
    return {
      ...DEFAULT_PREFERENCES,
      ...prefs,
      // Ensure dateFormats includes defaults
      dateFormats: prefs.dateFormats || DEFAULT_PREFERENCES.dateFormats
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet, return defaults
      return { ...DEFAULT_PREFERENCES };
    }
    console.error('Error loading preferences:', error);
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Save user preferences to disk
 * @param {Object} preferences - The preferences object to save
 * @returns {Promise<void>}
 */
async function savePreferences(preferences) {
  try {
    const prefsPath = getPreferencesPath();
    // Ensure user data directory exists
    await fs.mkdir(path.dirname(prefsPath), { recursive: true });
    await fs.writeFile(prefsPath, JSON.stringify(preferences, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving preferences:', error);
    throw error;
  }
}

/**
 * Add a filename pattern to recent patterns
 * @param {Object} preferences - Current preferences
 * @param {string} pattern - The filename pattern to add
 * @returns {Object} Updated preferences
 */
function addRecentPattern(preferences, pattern) {
  if (!pattern || typeof pattern !== 'string') {
    return preferences;
  }
  
  // Remove pattern if it already exists (to move it to the front)
  const filtered = preferences.recentFilenamePatterns.filter(p => p !== pattern);
  
  // Add to front of array
  const updated = [pattern, ...filtered];
  
  // Keep only the most recent N patterns
  const maxPatterns = preferences.maxRecentPatterns || DEFAULT_PREFERENCES.maxRecentPatterns;
  const trimmed = updated.slice(0, maxPatterns);
  
  return {
    ...preferences,
    recentFilenamePatterns: trimmed,
    lastUsedPattern: pattern
  };
}

/**
 * Set the preferred date format
 * @param {Object} preferences - Current preferences
 * @param {string} format - The date format string (e.g., 'YYYY-MM-DD')
 * @returns {Object} Updated preferences
 */
function setPreferredDateFormat(preferences, format) {
  return {
    ...preferences,
    preferredDateFormat: format
  };
}

/**
 * Set the preferred video quality
 * @param {Object} preferences - Current preferences
 * @param {string} quality - The quality option ('copy', 'high', 'medium', 'low')
 * @returns {Object} Updated preferences
 */
function setPreferredQuality(preferences, quality) {
  return {
    ...preferences,
    preferredQuality: quality
  };
}

/**
 * Format a date using the specified format string
 * @param {Date} date - The date to format
 * @param {string} format - Format string (supports YYYY, MM, DD, YY, M, D)
 * @returns {string} Formatted date string
 */
function formatDate(date, format) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 0-indexed
  const day = date.getDate();
  
  // Replace longer patterns first to avoid partial replacements
  return format
    .replace(/YYYY/g, year.toString())
    .replace(/YY/g, year.toString().slice(-2))
    .replace(/MM/g, month.toString().padStart(2, '0'))
    .replace(/DD/g, day.toString().padStart(2, '0'))
    .replace(/M/g, month.toString())
    .replace(/D/g, day.toString());
}

/**
 * Apply date tokens to a filename pattern
 * Replaces tokens like {date}, {year}, {month}, {day} with actual values
 * @param {string} pattern - Pattern with date tokens
 * @param {Date} date - Date to use for tokens (defaults to current date)
 * @param {string} dateFormat - Preferred date format
 * @returns {string} Pattern with tokens replaced
 */
function applyDateTokens(pattern, date = new Date(), dateFormat = 'YYYY-MM-DD') {
  if (!pattern) return pattern;
  
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const formattedDate = formatDate(date, dateFormat);
  
  return pattern
    .replace(/{date}/gi, formattedDate)
    .replace(/{year}/gi, year.toString())
    .replace(/{month}/gi, month)
    .replace(/{day}/gi, day);
}

/**
 * Add a failed operation to the preferences for later recovery
 * @param {Object} preferences - Current preferences
 * @param {Object} operation - Failed operation details (sessionId, files, outputPath, error, timestamp)
 * @returns {Object} Updated preferences
 */
function addFailedOperation(preferences, operation) {
  if (!operation || !operation.sessionId) {
    return preferences;
  }
  
  const failedOps = preferences.failedOperations || [];
  
  // Check if this operation already exists (by sessionId and outputPath)
  const existingIndex = failedOps.findIndex(
    op => op.sessionId === operation.sessionId && op.outputPath === operation.outputPath
  );
  
  if (existingIndex >= 0) {
    // Update existing operation
    failedOps[existingIndex] = {
      ...operation,
      timestamp: Date.now(), // Update timestamp
      retryCount: (failedOps[existingIndex].retryCount || 0) + 1
    };
  } else {
    // Add new failed operation
    failedOps.push({
      ...operation,
      timestamp: operation.timestamp || Date.now(),
      retryCount: 0
    });
  }
  
  return {
    ...preferences,
    failedOperations: failedOps
  };
}

/**
 * Remove a failed operation from preferences
 * @param {Object} preferences - Current preferences
 * @param {string} sessionId - Session ID of the operation to remove
 * @param {string} outputPath - Output path of the operation to remove
 * @returns {Object} Updated preferences
 */
function removeFailedOperation(preferences, sessionId, outputPath) {
  const failedOps = preferences.failedOperations || [];
  
  return {
    ...preferences,
    failedOperations: failedOps.filter(
      op => !(op.sessionId === sessionId && op.outputPath === outputPath)
    )
  };
}

/**
 * Get all failed operations
 * @param {Object} preferences - Current preferences
 * @returns {Array} Array of failed operations
 */
function getFailedOperations(preferences) {
  return preferences.failedOperations || [];
}

/**
 * Clear all failed operations
 * @param {Object} preferences - Current preferences
 * @returns {Object} Updated preferences
 */
function clearFailedOperations(preferences) {
  return {
    ...preferences,
    failedOperations: []
  };
}

module.exports = {
  loadPreferences,
  savePreferences,
  addRecentPattern,
  setPreferredDateFormat,
  setPreferredQuality,
  formatDate,
  applyDateTokens,
  addFailedOperation,
  removeFailedOperation,
  getFailedOperations,
  clearFailedOperations,
  DEFAULT_PREFERENCES
};
