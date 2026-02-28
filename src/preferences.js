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
  dateFormats: [
    { name: 'ISO (YYYY-MM-DD)', format: 'YYYY-MM-DD' },
    { name: 'US (MM-DD-YYYY)', format: 'MM-DD-YYYY' },
    { name: 'European (DD-MM-YYYY)', format: 'DD-MM-YYYY' },
    { name: 'Compact (YYYYMMDD)', format: 'YYYYMMDD' }
  ],
  recentDirectories: [], // Recent folders/files accessed
  pinnedDirectories: [], // User-pinned directories for quick access
  maxRecentDirectories: 10
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
      dateFormats: prefs.dateFormats || DEFAULT_PREFERENCES.dateFormats,
      // Ensure recent directories arrays exist
      recentDirectories: prefs.recentDirectories || [],
      pinnedDirectories: prefs.pinnedDirectories || []
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
 * Add a directory to recent directories
 * @param {Object} preferences - Current preferences
 * @param {string} dirPath - The directory path to add
 * @returns {Object} Updated preferences
 */
function addRecentDirectory(preferences, dirPath) {
  if (!dirPath || typeof dirPath !== 'string') {
    return preferences;
  }
  
  const recentDirs = preferences.recentDirectories || [];
  const pinnedDirs = preferences.pinnedDirectories || [];
  
  // Don't add to recent if it's already pinned
  if (pinnedDirs.some(item => item.path === dirPath)) {
    return preferences;
  }
  
  // Remove directory if it already exists (to move it to the front)
  const filtered = recentDirs.filter(item => item.path !== dirPath);
  
  // Add to front of array with current timestamp
  const newItem = {
    path: dirPath,
    lastUsed: new Date().toISOString()
  };
  const updated = [newItem, ...filtered];
  
  // Keep only the most recent N directories
  const maxDirs = preferences.maxRecentDirectories || DEFAULT_PREFERENCES.maxRecentDirectories;
  const trimmed = updated.slice(0, maxDirs);
  
  return {
    ...preferences,
    recentDirectories: trimmed
  };
}

/**
 * Pin a directory for quick access
 * @param {Object} preferences - Current preferences
 * @param {string} dirPath - The directory path to pin
 * @returns {Object} Updated preferences
 */
function pinDirectory(preferences, dirPath) {
  if (!dirPath || typeof dirPath !== 'string') {
    return preferences;
  }
  
  const pinnedDirs = preferences.pinnedDirectories || [];
  
  // Don't add if already pinned
  if (pinnedDirs.some(item => item.path === dirPath)) {
    return preferences;
  }
  
  // Add to pinned with current timestamp
  const newItem = {
    path: dirPath,
    pinnedAt: new Date().toISOString()
  };
  
  // Remove from recent directories if present
  const recentDirs = (preferences.recentDirectories || []).filter(item => item.path !== dirPath);
  
  return {
    ...preferences,
    pinnedDirectories: [...pinnedDirs, newItem],
    recentDirectories: recentDirs
  };
}

/**
 * Unpin a directory
 * @param {Object} preferences - Current preferences
 * @param {string} dirPath - The directory path to unpin
 * @returns {Object} Updated preferences
 */
function unpinDirectory(preferences, dirPath) {
  if (!dirPath || typeof dirPath !== 'string') {
    return preferences;
  }
  
  const pinnedDirs = (preferences.pinnedDirectories || []).filter(item => item.path !== dirPath);
  
  return {
    ...preferences,
    pinnedDirectories: pinnedDirs
  };
}

/**
 * Clear all recent directories
 * @param {Object} preferences - Current preferences
 * @returns {Object} Updated preferences
 */
function clearRecentDirectories(preferences) {
  return {
    ...preferences,
    recentDirectories: []
  };
}

/**
 * Remove invalid/non-existent directories from recent and pinned lists
 * @param {Object} preferences - Current preferences
 * @param {Function} existsCheck - Async function to check if path exists
 * @returns {Promise<Object>} Updated preferences
 */
async function cleanupDirectories(preferences, existsCheck) {
  const recentDirs = preferences.recentDirectories || [];
  const pinnedDirs = preferences.pinnedDirectories || [];
  
  const validRecent = [];
  const validPinned = [];
  
  // Check recent directories
  for (const item of recentDirs) {
    if (await existsCheck(item.path)) {
      validRecent.push(item);
    }
  }
  
  // Check pinned directories
  for (const item of pinnedDirs) {
    if (await existsCheck(item.path)) {
      validPinned.push(item);
    }
  }
  
  return {
    ...preferences,
    recentDirectories: validRecent,
    pinnedDirectories: validPinned
  };
}

module.exports = {
  loadPreferences,
  savePreferences,
  addRecentPattern,
  setPreferredDateFormat,
  formatDate,
  applyDateTokens,
  addRecentDirectory,
  pinDirectory,
  unpinDirectory,
  clearRecentDirectories,
  cleanupDirectories,
  DEFAULT_PREFERENCES
};
