/**
 * Tests for error-mapper module
 */

const { mapError, formatErrorForLog, ERROR_MAPPINGS } = require('../src/error-mapper');

describe('error-mapper', () => {
  describe('mapError', () => {
    test('should map file not found error', () => {
      const error = new Error('no such file or directory');
      const mapped = mapError(error);
      
      expect(mapped.userMessage).toBe('File Not Found');
      expect(mapped.code).toBe('FILE_NOT_FOUND');
      expect(mapped.fixes).toBeDefined();
      expect(mapped.fixes.length).toBeGreaterThan(0);
      expect(mapped.technicalDetails).toBe('no such file or directory');
    });

    test('should map invalid data error', () => {
      const error = new Error('Invalid data found when processing input');
      const mapped = mapError(error);
      
      expect(mapped.userMessage).toBe('Invalid Video File');
      expect(mapped.code).toBe('INVALID_FILE');
      expect(mapped.suggestion).toBeDefined();
    });

    test('should map permission denied error', () => {
      const error = 'permission denied: /path/to/file.mp4';
      const mapped = mapError(error);
      
      expect(mapped.userMessage).toBe('Permission Denied');
      expect(mapped.code).toBe('PERMISSION_DENIED');
      expect(mapped.fixes.length).toBeGreaterThan(0);
    });

    test('should map disk space error', () => {
      const error = new Error('no space left on device');
      const mapped = mapError(error);
      
      expect(mapped.userMessage).toBe('Not Enough Disk Space');
      expect(mapped.code).toBe('NO_SPACE');
    });

    test('should map codec error', () => {
      const error = new Error('codec not found');
      const mapped = mapError(error);
      
      expect(mapped.userMessage).toBe('Unsupported Video Codec');
      expect(mapped.code).toBe('UNSUPPORTED_CODEC');
    });

    test('should map timeout error', () => {
      const error = new Error('operation timed out');
      const mapped = mapError(error);
      
      expect(mapped.userMessage).toBe('Operation Timed Out');
      expect(mapped.code).toBe('TIMEOUT');
    });

    test('should map file exists error', () => {
      const error = 'file already exists';
      const mapped = mapError(error);
      
      expect(mapped.userMessage).toBe('File Already Exists');
      expect(mapped.code).toBe('FILE_EXISTS');
    });

    test('should map ffmpeg not found error', () => {
      const error = new Error('ffmpeg not found');
      const mapped = mapError(error);
      
      expect(mapped.userMessage).toBe('FFmpeg Not Found');
      expect(mapped.code).toBe('FFMPEG_NOT_FOUND');
    });

    test('should handle unknown errors with fallback', () => {
      const error = new Error('Some completely unknown error');
      const mapped = mapError(error);
      
      expect(mapped.userMessage).toBe('An Unexpected Error Occurred');
      expect(mapped.code).toBe('UNKNOWN_ERROR');
      expect(mapped.fixes).toBeDefined();
      expect(mapped.technicalDetails).toBe('Some completely unknown error');
    });

    test('should handle string errors', () => {
      const error = 'A plain string error message';
      const mapped = mapError(error);
      
      expect(mapped.technicalDetails).toBe('A plain string error message');
      expect(mapped.userMessage).toBeDefined();
      expect(mapped.code).toBeDefined();
    });

    test('should handle Error objects without message', () => {
      const error = new Error();
      const mapped = mapError(error);
      
      expect(mapped.userMessage).toBeDefined();
      expect(mapped.code).toBeDefined();
      expect(mapped.fixes).toBeDefined();
    });
  });

  describe('formatErrorForLog', () => {
    test('should format error for logging', () => {
      const mappedError = {
        code: 'FILE_NOT_FOUND',
        userMessage: 'File Not Found',
        suggestion: 'The file could not be found'
      };
      
      const formatted = formatErrorForLog(mappedError);
      
      expect(formatted).toContain('FILE_NOT_FOUND');
      expect(formatted).toContain('File Not Found');
      expect(formatted).toContain('The file could not be found');
    });
  });

  describe('ERROR_MAPPINGS', () => {
    test('should have valid structure', () => {
      expect(ERROR_MAPPINGS).toBeDefined();
      expect(Array.isArray(ERROR_MAPPINGS)).toBe(true);
      expect(ERROR_MAPPINGS.length).toBeGreaterThan(0);
      
      ERROR_MAPPINGS.forEach(mapping => {
        expect(mapping.pattern).toBeDefined();
        expect(mapping.pattern instanceof RegExp).toBe(true);
        expect(mapping.userMessage).toBeDefined();
        expect(mapping.suggestion).toBeDefined();
        expect(mapping.fixes).toBeDefined();
        expect(Array.isArray(mapping.fixes)).toBe(true);
        expect(mapping.fixes.length).toBeGreaterThan(0);
        expect(mapping.code).toBeDefined();
      });
    });
  });

  describe('case insensitive matching', () => {
    test('should match errors regardless of case', () => {
      const errors = [
        'NO SUCH FILE OR DIRECTORY',
        'No Such File Or Directory',
        'no such file or directory'
      ];
      
      errors.forEach(errorMsg => {
        const mapped = mapError(errorMsg);
        expect(mapped.code).toBe('FILE_NOT_FOUND');
      });
    });
  });

  describe('complex error messages', () => {
    test('should extract error from ffmpeg output', () => {
      const error = `[mp4 @ 0x7f8f] moov atom not found
      /path/to/video.mp4: Invalid data found when processing input`;
      
      const mapped = mapError(error);
      expect(mapped.code).toBe('INVALID_FILE');
    });

    test('should handle multi-line error messages', () => {
      const error = `Error occurred:
      Line 1
      permission denied accessing file
      Line 3`;
      
      const mapped = mapError(error);
      expect(mapped.code).toBe('PERMISSION_DENIED');
    });
  });
});
