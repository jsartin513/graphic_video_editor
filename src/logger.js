const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { app } = require('electron');

// Log levels
const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

// Log level priorities for filtering
const LogLevelPriority = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

class Logger {
  constructor() {
    this.debugMode = false;
    this.logDir = null;
    this.currentLogFile = null;
    this.maxLogSize = 5 * 1024 * 1024; // 5MB per log file
    this.maxLogFiles = 5; // Keep last 5 log files
    this.initialized = false;
  }

  /**
   * Initialize the logger with the app's user data path
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Get the user data directory
      const userDataPath = app.getPath('userData');
      this.logDir = path.join(userDataPath, 'logs');

      // Create logs directory if it doesn't exist
      await fs.mkdir(this.logDir, { recursive: true });

      // Set current log file
      this.currentLogFile = path.join(this.logDir, 'app.log');

      this.initialized = true;
      this.info('Logger initialized', { logDir: this.logDir });
    } catch (error) {
      console.error('Failed to initialize logger:', error);
      this.initialized = false;
    }
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Whether debug mode should be enabled
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    this.info('Debug mode changed', { debugMode: enabled });
  }

  /**
   * Get current debug mode status
   * @returns {boolean}
   */
  getDebugMode() {
    return this.debugMode;
  }

  /**
   * Format a log entry
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {object} context - Additional context
   * @returns {string}
   */
  formatLogEntry(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(context).length > 0 
      ? ' ' + JSON.stringify(context)
      : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}\n`;
  }

  /**
   * Write log to file
   * @param {string} logEntry - Formatted log entry
   */
  async writeToFile(logEntry) {
    if (!this.initialized || !this.debugMode) {
      return;
    }

    try {
      // Check if log rotation is needed
      await this.rotateLogsIfNeeded();

      // Append to current log file
      await fs.appendFile(this.currentLogFile, logEntry, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Rotate logs if current log file exceeds max size
   */
  async rotateLogsIfNeeded() {
    try {
      const stats = await fs.stat(this.currentLogFile);
      
      if (stats.size >= this.maxLogSize) {
        // Rotate logs
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedLogFile = path.join(this.logDir, `app-${timestamp}.log`);
        
        // Rename current log file
        await fs.rename(this.currentLogFile, rotatedLogFile);
        
        // Clean up old log files
        await this.cleanupOldLogs();
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to rotate logs:', error);
      }
    }
  }

  /**
   * Clean up old log files, keeping only the most recent ones
   */
  async cleanupOldLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files
        .filter(f => f.startsWith('app-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.logDir, f),
          time: fsSync.statSync(path.join(this.logDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Sort by newest first

      // Remove old log files
      if (logFiles.length > this.maxLogFiles) {
        const filesToDelete = logFiles.slice(this.maxLogFiles);
        for (const file of filesToDelete) {
          await fs.unlink(file.path);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  /**
   * Log a message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {object} context - Additional context
   */
  async log(level, message, context = {}) {
    // Format log entry
    const logEntry = this.formatLogEntry(level, message, context);

    // Always log to console
    const consoleMethod = level === LogLevel.ERROR ? 'error' 
                        : level === LogLevel.WARN ? 'warn'
                        : 'log';
    console[consoleMethod](`[${level.toUpperCase()}]`, message, context);

    // Write to file if debug mode is enabled
    await this.writeToFile(logEntry);
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {object} context - Additional context
   */
  async debug(message, context = {}) {
    if (this.debugMode) {
      await this.log(LogLevel.DEBUG, message, context);
    }
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {object} context - Additional context
   */
  async info(message, context = {}) {
    await this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {object} context - Additional context
   */
  async warn(message, context = {}) {
    await this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {object} context - Additional context
   */
  async error(message, context = {}) {
    await this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Get all log files
   * @returns {Promise<Array>} Array of log file objects with name, path, and size
   */
  async getLogFiles() {
    if (!this.initialized) {
      return [];
    }

    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = [];

      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = await fs.stat(filePath);
          logFiles.push({
            name: file,
            path: filePath,
            size: stats.size,
            modified: stats.mtime
          });
        }
      }

      // Sort by modification time, newest first
      return logFiles.sort((a, b) => b.modified - a.modified);
    } catch (error) {
      this.error('Failed to get log files', { error: error.message });
      return [];
    }
  }

  /**
   * Read logs from a specific file
   * @param {string} filename - Name of the log file (optional, defaults to current)
   * @param {number} maxLines - Maximum number of lines to return (default: 1000)
   * @returns {Promise<string>} Log content
   */
  async readLogs(filename = null, maxLines = 1000) {
    if (!this.initialized) {
      return '';
    }

    try {
      const logFile = filename 
        ? path.join(this.logDir, filename)
        : this.currentLogFile;

      const content = await fs.readFile(logFile, 'utf8');
      
      // Handle empty file
      if (!content) {
        return '';
      }
      
      const lines = content.split('\n');

      // Return last N lines
      return lines.slice(-maxLines).join('\n');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return ''; // File doesn't exist yet
      }
      this.error('Failed to read logs', { error: error.message, filename });
      return '';
    }
  }

  /**
   * Clear all log files
   * @returns {Promise<void>}
   */
  async clearLogs() {
    if (!this.initialized) {
      return;
    }

    try {
      const files = await fs.readdir(this.logDir);
      
      for (const file of files) {
        if (file.endsWith('.log')) {
          await fs.unlink(path.join(this.logDir, file));
        }
      }

      this.info('All logs cleared');
    } catch (error) {
      this.error('Failed to clear logs', { error: error.message });
    }
  }

  /**
   * Export logs to a specific destination
   * @param {string} destinationPath - Path where logs should be exported
   * @returns {Promise<object>} Result object with success status
   */
  async exportLogs(destinationPath) {
    if (!this.initialized) {
      return { success: false, error: 'Logger not initialized' };
    }

    try {
      const logFiles = await this.getLogFiles();
      const exportedFiles = [];

      for (const logFile of logFiles) {
        const destFile = path.join(destinationPath, logFile.name);
        await fs.copyFile(logFile.path, destFile);
        exportedFiles.push(destFile);
      }

      this.info('Logs exported', { destination: destinationPath, count: exportedFiles.length });
      return { success: true, files: exportedFiles };
    } catch (error) {
      this.error('Failed to export logs', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = {
  logger,
  LogLevel
};
