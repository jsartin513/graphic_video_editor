const { getFileName, escapeHtml, formatDate, formatDuration, getDirectoryName } = require('../src/utils.js');

describe('getFileName', () => {
  test('extracts filename from Unix path', () => {
    expect(getFileName('/path/to/video.mp4')).toBe('video.mp4');
  });

  test('extracts filename from Windows path', () => {
    expect(getFileName('C:\\Users\\Videos\\video.mp4')).toBe('video.mp4');
  });

  test('extracts filename from mixed separators', () => {
    expect(getFileName('/path\\to/video.mp4')).toBe('video.mp4');
  });

  test('handles filename without path', () => {
    expect(getFileName('video.mp4')).toBe('video.mp4');
  });

  test('handles path ending with separator', () => {
    expect(getFileName('/path/to/')).toBe('');
  });

  test('handles empty string', () => {
    expect(getFileName('')).toBe('');
  });

  test('handles path with multiple consecutive separators', () => {
    expect(getFileName('/path//to///video.mp4')).toBe('video.mp4');
  });
});

describe('escapeHtml', () => {
  test('escapes less than symbol', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  test('escapes greater than symbol', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  test('escapes ampersand', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  test('escapes quotes', () => {
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
  });

  test('escapes single quotes', () => {
    expect(escapeHtml("it's")).toContain('&#');
  });

  test('prevents XSS attack with script tag', () => {
    const malicious = '<script>alert("XSS")</script>';
    const escaped = escapeHtml(malicious);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
  });

  test('prevents XSS with event handler', () => {
    const malicious = '<img src=x onerror="alert(1)">';
    const escaped = escapeHtml(malicious);
    expect(escaped).not.toContain('<img');
    expect(escaped).toContain('&lt;img');
  });

  test('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  test('handles plain text without special characters', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  test('handles multiple special characters', () => {
    const text = '<div>"Hello" & \'Goodbye\'</div>';
    const escaped = escapeHtml(text);
    expect(escaped).toContain('&lt;');
    expect(escaped).toContain('&gt;');
    expect(escaped).toContain('&quot;');
    expect(escaped).toContain('&amp;');
  });
});

describe('formatDate', () => {
  // Mock toLocaleDateString and toLocaleTimeString for consistent testing
  beforeAll(() => {
    // Save original functions
    global.originalToLocaleDateString = Date.prototype.toLocaleDateString;
    global.originalToLocaleTimeString = Date.prototype.toLocaleTimeString;

    // Mock with consistent output
    Date.prototype.toLocaleDateString = function() {
      return '1/15/2024';
    };
    Date.prototype.toLocaleTimeString = function(locales, options) {
      return '3:30 PM';
    };
  });

  afterAll(() => {
    // Restore original functions
    Date.prototype.toLocaleDateString = global.originalToLocaleDateString;
    Date.prototype.toLocaleTimeString = global.originalToLocaleTimeString;
  });

  test('formats valid date string', () => {
    const result = formatDate('2024-01-15T15:30:00');
    expect(result).toBe('1/15/2024 3:30 PM');
  });

  test('formats ISO date string', () => {
    const result = formatDate('2024-01-15T15:30:00.000Z');
    expect(result).toBe('1/15/2024 3:30 PM');
  });

  test('formats timestamp', () => {
    const result = formatDate(1705332600000); // 2024-01-15 15:30:00 UTC
    expect(result).toBe('1/15/2024 3:30 PM');
  });
});

describe('formatDuration', () => {
  test('formats duration with hours', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  test('formats duration with only minutes and seconds', () => {
    expect(formatDuration(125)).toBe('2:05');
  });

  test('formats duration less than a minute', () => {
    expect(formatDuration(45)).toBe('0:45');
  });

  test('formats zero duration', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  test('pads single digit minutes in hours format', () => {
    expect(formatDuration(3605)).toBe('1:00:05');
  });

  test('pads single digit seconds', () => {
    expect(formatDuration(65)).toBe('1:05');
  });

  test('formats exact hour', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
  });

  test('formats exact minute', () => {
    expect(formatDuration(60)).toBe('1:00');
  });

  test('formats multi-hour duration', () => {
    expect(formatDuration(7384)).toBe('2:03:04');
  });

  test('handles null duration', () => {
    expect(formatDuration(null)).toBe('Unknown');
  });

  test('handles undefined duration', () => {
    expect(formatDuration(undefined)).toBe('Unknown');
  });

  test('handles NaN duration', () => {
    expect(formatDuration(NaN)).toBe('Unknown');
  });

  test('handles empty string', () => {
    expect(formatDuration('')).toBe('Unknown');
  });

  test('handles non-numeric string', () => {
    expect(formatDuration('abc')).toBe('Unknown');
  });

  test('handles negative duration', () => {
    // Negative durations should still format (though unusual)
    const result = formatDuration(-125);
    expect(result).toMatch(/:/); // Should still return formatted string
  });

  test('rounds down decimal seconds', () => {
    expect(formatDuration(125.9)).toBe('2:05');
  });
});

describe('getDirectoryName', () => {
  test('extracts directory name from Unix path', () => {
    expect(getDirectoryName('/videos/folder1/video.mp4')).toBe('folder1');
  });

  test('extracts directory name from Windows path', () => {
    expect(getDirectoryName('C:\\Users\\Videos\\video.mp4')).toBe('Videos');
  });

  test('extracts directory name from mixed separators', () => {
    expect(getDirectoryName('/path\\to/file.mp4')).toBe('to');
  });

  test('handles path with only filename (no directory)', () => {
    expect(getDirectoryName('video.mp4')).toBe('root');
  });

  test('handles empty string', () => {
    expect(getDirectoryName('')).toBe('root');
  });

  test('handles null', () => {
    expect(getDirectoryName(null)).toBe('root');
  });

  test('handles undefined', () => {
    expect(getDirectoryName(undefined)).toBe('root');
  });

  test('handles number input', () => {
    expect(getDirectoryName(123)).toBe('root');
  });

  test('handles path with trailing slash', () => {
    // With trailing slash on folder1, we're asking for folder1's parent
    expect(getDirectoryName('/videos/folder1/')).toBe('videos');
  });

  test('handles root path', () => {
    expect(getDirectoryName('/')).toBe('root');
  });

  test('handles Windows root path', () => {
    expect(getDirectoryName('C:\\')).toBe('root');
  });

  test('handles path with multiple consecutive separators', () => {
    expect(getDirectoryName('/videos//folder1///video.mp4')).toBe('folder1');
  });

  test('handles deeply nested path', () => {
    expect(getDirectoryName('/a/b/c/d/e/f/video.mp4')).toBe('f');
  });

  test('handles path with spaces in directory name', () => {
    expect(getDirectoryName('/my videos/folder 1/video.mp4')).toBe('folder 1');
  });

  test('handles path with special characters', () => {
    expect(getDirectoryName('/videos/my-folder_123/video.mp4')).toBe('my-folder_123');
  });
});
