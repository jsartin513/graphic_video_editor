/**
 * User Preferences Module
 * Manages storage and retrieval of user preferences for file naming patterns and date formats
 */

const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const { logger } = require('./logger');

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
  debugMode: false, // Debug logging mode
  dateFormats: [
    { name: 'ISO (YYYY-MM-DD)', format: 'YYYY-MM-DD' },
    { name: 'US (MM-DD-YYYY)', format: 'MM-DD-YYYY' },
    { name: 'European (DD-MM-YYYY)', format: 'DD-MM-YYYY' },
    { name: 'Compact (YYYYMMDD)', format: 'YYYYMMDD' }
  ]
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
    logger.error('Error loading preferences', { error: error.message });
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
    logger.error('Error saving preferences', { error: error.message });
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

module.exports = {
  loadPreferences,
  savePreferences,
  addRecentPattern,
  setPreferredDateFormat,
  formatDate,
  applyDateTokens,
  DEFAULT_PREFERENCES
};
