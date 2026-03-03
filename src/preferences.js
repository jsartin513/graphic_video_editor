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
  preferredQuality: 'copy', // Default to copy (fastest, no re-encoding)
  preferredFormat: 'mp4', // Default to MP4 (most compatible)
  lastOutputDestination: null, // Last selected output directory (null = use default)
  debugMode: false, // Debug logging mode
  dateFormats: [
    { name: 'ISO (YYYY-MM-DD)', format: 'YYYY-MM-DD' },
    { name: 'US (MM-DD-YYYY)', format: 'MM-DD-YYYY' },
    { name: 'European (DD-MM-YYYY)', format: 'DD-MM-YYYY' },
    { name: 'Compact (YYYYMMDD)', format: 'YYYYMMDD' }
  ],
  recentDirectories: [], // Recent folders/files accessed
  pinnedDirectories: [], // User-pinned directories for quick access
  maxRecentDirectories: 10,
  // SD Card detection settings
  autoDetectSDCards: true,
  knownSDCardPaths: [],
  lastSDCardPath: null,
  showSDCardNotifications: true,
  failedOperations: [], // Track failed merge operations for recovery
  eventTemplates: [], // Reusable filename patterns: [{ name, pattern }]
  maxEventTemplates: 10
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
      pinnedDirectories: prefs.pinnedDirectories || [],
      eventTemplates: Array.isArray(prefs.eventTemplates) ? prefs.eventTemplates : []
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
 * Set the preferred export format
 * @param {Object} preferences - Current preferences
 * @param {string} format - The format option ('mp4', 'mov', 'mkv', 'avi', 'm4v')
 * @returns {Object} Updated preferences
 */
function setPreferredFormat(preferences, format) {
  return {
    ...preferences,
    preferredFormat: format
  };
}

/**
 * Set the last used output destination
 * @param {Object} preferences - Current preferences
 * @param {string|null} destination - The output destination path (null = use default)
 * @returns {Object} Updated preferences
 */
function setLastOutputDestination(preferences, destination) {
  return {
    ...preferences,
    lastOutputDestination: destination
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
 * Also supports custom tokens: {eventName}, {leagueName}, {weekName}
 * @param {string} pattern - Pattern with date tokens
 * @param {Date} date - Date to use for tokens (defaults to current date)
 * @param {string} dateFormat - Preferred date format
 * @param {Object} [customTokens] - Optional { eventName, leagueName, weekName }
 * @returns {string} Pattern with tokens replaced
 */
function applyDateTokens(pattern, date = new Date(), dateFormat = 'YYYY-MM-DD', customTokens = {}) {
  if (!pattern) return pattern;

  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const formattedDate = formatDate(date, dateFormat);

  let result = pattern
    .replace(/{date}/gi, formattedDate)
    .replace(/{year}/gi, year.toString())
    .replace(/{month}/gi, month)
    .replace(/{day}/gi, day);

  if (customTokens && typeof customTokens === 'object') {
    result = result
      .replace(/\{eventName\}/gi, String(customTokens.eventName ?? '').trim())
      .replace(/\{leagueName\}/gi, String(customTokens.leagueName ?? '').trim())
      .replace(/\{weekName\}/gi, String(customTokens.weekName ?? '').trim());
  }

  return result;
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

  // Keep only the most recent N directories (by lastUsed, newest first)
  const maxDirs = preferences.maxRecentDirectories || DEFAULT_PREFERENCES.maxRecentDirectories;
  const sorted = [...updated].sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
  const trimmed = sorted.slice(0, maxDirs);

  return {
    ...preferences,
    recentDirectories: trimmed
  };
}

/**
 * Add an SD card path to known SD card paths
 * @param {Object} preferences - Current preferences
 * @param {string} sdCardPath - The SD card path to remember
 * @returns {Object} Updated preferences
 */
function addSDCardPath(preferences, sdCardPath) {
  if (!sdCardPath || typeof sdCardPath !== 'string') {
    return preferences;
  }

  // Remove if already exists
  const filtered = (preferences.knownSDCardPaths || []).filter(p => p !== sdCardPath);

  // Add to front of array
  const updated = [sdCardPath, ...filtered];

  // Keep only the most recent 10 paths
  const trimmed = updated.slice(0, 10);

  return {
    ...preferences,
    knownSDCardPaths: trimmed,
    lastSDCardPath: sdCardPath
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
 * Sanitize and validate a failed operation before storing
 * @param {Object} operation - Raw operation from renderer
 * @returns {Object} Sanitized operation
 * @throws {Error} If operation is invalid or too large
 */
function sanitizeFailedOperation(operation) {
  const MAX_STRING_LENGTH = 1024;
  const MAX_FILES = 100;
  const MAX_SERIALIZED_LENGTH = 10 * 1024; // 10 KB

  if (!operation || typeof operation !== 'object') {
    throw new Error('Invalid failed operation: expected an object.');
  }

  const sanitized = {};

  if (typeof operation.sessionId === 'string') {
    sanitized.sessionId = operation.sessionId.trim().slice(0, MAX_STRING_LENGTH);
  }
  if (!sanitized.sessionId) {
    throw new Error('Invalid failed operation: missing sessionId.');
  }

  if (typeof operation.outputPath === 'string') {
    sanitized.outputPath = operation.outputPath.trim().slice(0, MAX_STRING_LENGTH);
  }
  if (!sanitized.outputPath) {
    throw new Error('Invalid failed operation: missing outputPath.');
  }

  if (Array.isArray(operation.files)) {
    sanitized.files = operation.files
      .filter(f => typeof f === 'string')
      .slice(0, MAX_FILES)
      .map(f => f.slice(0, MAX_STRING_LENGTH));
  } else {
    sanitized.files = [];
  }

  if (typeof operation.timestamp === 'number' && Number.isFinite(operation.timestamp)) {
    sanitized.timestamp = operation.timestamp;
  } else {
    sanitized.timestamp = Date.now();
  }

  if (typeof operation.error === 'string') {
    sanitized.error = operation.error.slice(0, MAX_STRING_LENGTH);
  } else {
    sanitized.error = '';
  }

  const serialized = JSON.stringify(sanitized);
  if (serialized.length > MAX_SERIALIZED_LENGTH) {
    throw new Error('Failed operation too large to store.');
  }

  return sanitized;
}

/**
 * Add a failed operation to the preferences for later recovery
 * @param {Object} preferences - Current preferences
 * @param {Object} operation - Failed operation details (sessionId, files, outputPath, error, timestamp)
 * @returns {Object} Updated preferences
 */
const MAX_FAILED_OPERATIONS = 50;

function addFailedOperation(preferences, operation) {
  if (
    !operation ||
    !operation.sessionId ||
    typeof operation.outputPath !== 'string' ||
    operation.outputPath.trim() === ''
  ) {
    return preferences;
  }

  const existingFailedOps = Array.isArray(preferences.failedOperations)
    ? preferences.failedOperations
    : [];
  const failedOps = [...existingFailedOps];

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

  // Keep only the most recent MAX_FAILED_OPERATIONS entries
  const trimmed = failedOps
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_FAILED_OPERATIONS);

  return {
    ...preferences,
    failedOperations: trimmed
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
 * Set auto-detect SD cards preference
 * @param {Object} preferences - Current preferences
 * @param {boolean} enabled - Whether to enable auto-detection
 * @returns {Object} Updated preferences
 */
function setAutoDetectSDCards(preferences, enabled) {
  return {
    ...preferences,
    autoDetectSDCards: enabled
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

/**
 * Remove a failed operation from preferences
 * @param {Object} preferences - Current preferences
 * @param {string} sessionId - Session ID of the operation to remove
 * @param {string} outputPath - Output path of the operation to remove
 * @returns {Object} Updated preferences
 */
function removeFailedOperation(preferences, sessionId, outputPath) {
  const failedOps = Array.isArray(preferences.failedOperations) ? preferences.failedOperations : [];

  return {
    ...preferences,
    failedOperations: failedOps.filter(
      op => !(op.sessionId === sessionId && op.outputPath === outputPath)
    )
  };
}

/**
 * Set SD card notifications preference
 * @param {Object} preferences - Current preferences
 * @param {boolean} enabled - Whether to show notifications
 * @returns {Object} Updated preferences
 */
function setShowSDCardNotifications(preferences, enabled) {
  return {
    ...preferences,
    showSDCardNotifications: enabled
  };
}

/**
 * Get all failed operations
 * @param {Object} preferences - Current preferences
 * @returns {Array} Array of failed operations
 */
function getFailedOperations(preferences) {
  return Array.isArray(preferences.failedOperations) ? preferences.failedOperations : [];
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

/**
 * Add an event template (reusable filename pattern)
 * @param {Object} preferences - Current preferences
 * @param {Object} template - { name: string, pattern: string }
 * @returns {Object} Updated preferences
 */
function addEventTemplate(preferences, template) {
  if (!template || typeof template.name !== 'string' || !template.name.trim() ||
      typeof template.pattern !== 'string' || !template.pattern.trim()) {
    return preferences;
  }
  const name = template.name.trim();
  const pattern = template.pattern.trim();
  const templates = Array.isArray(preferences.eventTemplates) ? preferences.eventTemplates : [];
  const validTemplates = templates.filter(t => t && typeof t.name === 'string' && typeof t.pattern === 'string');
  const filtered = validTemplates.filter(t => t.name !== name);
  const updated = [{ name, pattern }, ...filtered];
  const max = preferences.maxEventTemplates ?? DEFAULT_PREFERENCES.maxEventTemplates;
  return {
    ...preferences,
    eventTemplates: updated.slice(0, max)
  };
}

module.exports = {
  loadPreferences,
  savePreferences,
  addRecentPattern,
  setPreferredDateFormat,
  setPreferredQuality,
  setPreferredFormat,
  setLastOutputDestination,
  formatDate,
  applyDateTokens,
  addRecentDirectory,
  pinDirectory,
  unpinDirectory,
  clearRecentDirectories,
  cleanupDirectories,
  addSDCardPath,
  setAutoDetectSDCards,
  setShowSDCardNotifications,
  sanitizeFailedOperation,
  addFailedOperation,
  removeFailedOperation,
  getFailedOperations,
  clearFailedOperations,
  addEventTemplate,
  DEFAULT_PREFERENCES
};
