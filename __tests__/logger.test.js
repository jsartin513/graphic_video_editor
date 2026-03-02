/**
 * Tests for Logger module
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      mkdir: jest.fn(),
      readdir: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      appendFile: jest.fn(),
      stat: jest.fn(),
      rename: jest.fn(),
      unlink: jest.fn(),
      copyFile: jest.fn()
    }
  };
});

const { Logger, LogLevel } = require('../src/logger');

describe('Logger', () => {
  let logger;

  beforeEach(() => {
    logger = new Logger();
    jest.clearAllMocks();
  });

  describe('formatLogEntry', () => {
    it('formats entry with level and message', () => {
      const result = logger.formatLogEntry('info', 'test message');
      expect(result).toMatch(/^\[\d{4}-\d{2}-\d{2}T[^\]]+\] \[INFO\] test message\n$/);
    });

    it('includes context when provided', () => {
      const result = logger.formatLogEntry('warn', 'msg', { key: 'value' });
      expect(result).toMatch(/\[WARN\] msg \{"key":"value"\}\n$/);
    });

    it('handles empty context', () => {
      const result = logger.formatLogEntry('error', 'err', {});
      expect(result).toMatch(/\[ERROR\] err\n$/);
    });

    it('uppercases log level', () => {
      const result = logger.formatLogEntry('debug', 'dbg');
      expect(result).toContain('[DEBUG]');
    });
  });

  describe('setDebugMode and getDebugMode', () => {
    it('defaults to false', () => {
      expect(logger.getDebugMode()).toBe(false);
    });

    it('sets and gets debug mode', () => {
      logger.setDebugMode(true);
      expect(logger.getDebugMode()).toBe(true);
      logger.setDebugMode(false);
      expect(logger.getDebugMode()).toBe(false);
    });
  });

  describe('writeToFile', () => {
    it('returns early when not initialized', async () => {
      await logger.writeToFile('[INFO] test\n');
      expect(fs.appendFile).not.toHaveBeenCalled();
    });

    it('returns early when debug mode is off', async () => {
      logger.logDir = '/tmp/logs';
      logger.currentLogFile = '/tmp/logs/app.log';
      logger.initialized = true;
      logger.debugMode = false;
      await logger.writeToFile('[INFO] test\n');
      expect(fs.appendFile).not.toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('creates logs directory and sets paths', async () => {
      fs.mkdir.mockResolvedValue(undefined);
      const { app } = require('electron');
      app.getPath.mockReturnValue('/tmp/user-data');

      await logger.initialize();

      expect(fs.mkdir).toHaveBeenCalledWith(path.join('/tmp/user-data', 'logs'), { recursive: true });
      expect(logger.initialized).toBe(true);
      expect(logger.logDir).toBe(path.join('/tmp/user-data', 'logs'));
      expect(logger.currentLogFile).toBe(path.join('/tmp/user-data', 'logs', 'app.log'));
    });

    it('does not re-initialize if already initialized', async () => {
      logger.initialized = true;
      logger.logDir = '/existing';
      fs.mkdir.mockResolvedValue(undefined);

      await logger.initialize();

      expect(fs.mkdir).not.toHaveBeenCalled();
    });
  });

  describe('getLogFiles', () => {
    it('returns empty array when not initialized', async () => {
      const result = await logger.getLogFiles();
      expect(result).toEqual([]);
      expect(fs.readdir).not.toHaveBeenCalled();
    });

    it('returns log files when initialized', async () => {
      logger.initialized = true;
      logger.logDir = '/tmp/logs';
      fs.readdir.mockResolvedValue(['app.log', 'app-2024-01-01.log']);
      fs.stat
        .mockResolvedValueOnce({ size: 100, mtime: new Date('2024-01-02') })
        .mockResolvedValueOnce({ size: 200, mtime: new Date('2024-01-01') });

      const result = await logger.getLogFiles();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('app.log');
      expect(result[1].name).toBe('app-2024-01-01.log');
    });
  });

  describe('readLogs', () => {
    it('returns empty string when not initialized', async () => {
      const result = await logger.readLogs();
      expect(result).toBe('');
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('reads and returns log content', async () => {
      logger.initialized = true;
      logger.logDir = '/tmp/logs';
      logger.currentLogFile = '/tmp/logs/app.log';
      fs.readFile.mockResolvedValue('line1\nline2\nline3');

      const result = await logger.readLogs();

      expect(result).toBe('line1\nline2\nline3');
      expect(fs.readFile).toHaveBeenCalledWith('/tmp/logs/app.log', 'utf8');
    });

    it('returns last N lines when maxLines specified', async () => {
      logger.initialized = true;
      logger.logDir = '/tmp/logs';
      logger.currentLogFile = '/tmp/logs/app.log';
      const lines = Array(5).fill('line').map((l, i) => `${l}${i}`);
      fs.readFile.mockResolvedValue(lines.join('\n'));

      const result = await logger.readLogs(null, 2);

      expect(result).toBe('line3\nline4');
    });

    it('returns empty string for ENOENT', async () => {
      logger.initialized = true;
      logger.logDir = '/tmp/logs';
      logger.currentLogFile = '/tmp/logs/app.log';
      const err = new Error('not found');
      err.code = 'ENOENT';
      fs.readFile.mockRejectedValue(err);

      const result = await logger.readLogs();

      expect(result).toBe('');
    });
  });

  describe('clearLogs', () => {
    it('does nothing when not initialized', async () => {
      await logger.clearLogs();
      expect(fs.readdir).not.toHaveBeenCalled();
    });

    it('removes all log files when initialized', async () => {
      logger.initialized = true;
      logger.logDir = '/tmp/logs';
      fs.readdir.mockResolvedValue(['app.log', 'app-old.log']);

      await logger.clearLogs();

      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });
  });

  describe('exportLogs', () => {
    it('returns error when not initialized', async () => {
      const result = await logger.exportLogs('/dest');
      expect(result).toEqual({ success: false, error: 'Logger not initialized' });
      expect(fs.copyFile).not.toHaveBeenCalled();
    });

    it('copies log files to destination when initialized', async () => {
      logger.initialized = true;
      logger.logDir = '/tmp/logs';
      fs.readdir.mockResolvedValue(['app.log']);
      fs.stat.mockResolvedValue({ size: 100, mtime: new Date() });
      fs.copyFile.mockResolvedValue(undefined);

      const result = await logger.exportLogs('/dest');

      expect(result.success).toBe(true);
      expect(result.files).toContain(path.join('/dest', 'app.log'));
      expect(fs.copyFile).toHaveBeenCalled();
    });
  });
});

describe('LogLevel', () => {
  it('exports expected levels', () => {
    expect(LogLevel.DEBUG).toBe('debug');
    expect(LogLevel.INFO).toBe('info');
    expect(LogLevel.WARN).toBe('warn');
    expect(LogLevel.ERROR).toBe('error');
  });
});
