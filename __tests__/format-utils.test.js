const { formatBytes } = require('../src/format-utils');

describe('formatBytes', () => {
  test('formats zero bytes', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
  });

  test('formats bytes', () => {
    expect(formatBytes(1)).toBe('1 Bytes');
    expect(formatBytes(500)).toBe('500 Bytes');
    expect(formatBytes(1023)).toBe('1023 Bytes');
  });

  test('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5120)).toBe('5 KB');
    expect(formatBytes(10240)).toBe('10 KB');
  });

  test('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1536 * 1024)).toBe('1.5 MB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatBytes(10.5 * 1024 * 1024)).toBe('10.5 MB');
  });

  test('formats gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
    expect(formatBytes(10 * 1024 * 1024 * 1024)).toBe('10 GB');
  });

  test('handles edge cases', () => {
    // Invalid inputs
    expect(formatBytes(null)).toBe('0 Bytes');
    expect(formatBytes(undefined)).toBe('0 Bytes');
    expect(formatBytes(NaN)).toBe('0 Bytes');
    expect(formatBytes('invalid')).toBe('0 Bytes');
    expect(formatBytes(-1)).toBe('0 Bytes'); // Negative bytes should be handled
    expect(formatBytes(-100)).toBe('0 Bytes'); // Negative numbers
    expect(formatBytes({})).toBe('0 Bytes'); // Objects
    expect(formatBytes([])).toBe('0 Bytes'); // Arrays
    
    // Very large numbers (should still work, capped at GB)
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1024 GB'); // Would be TB but we only support up to GB
  });

  test('rounds to 2 decimal places', () => {
    // Test that values are rounded appropriately
    expect(formatBytes(1536)).toBe('1.5 KB'); // 1.5 KB
    expect(formatBytes(1540)).toBe('1.5 KB'); // Should round to 1.5
    expect(formatBytes(1572)).toBe('1.54 KB'); // 1.535... should round to 1.54
  });

  test('handles typical file sizes', () => {
    // Common file sizes users might see
    expect(formatBytes(500 * 1024)).toBe('500 KB'); // ~500 KB video thumbnail
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB'); // ~5 MB video clip
    expect(formatBytes(100 * 1024 * 1024)).toBe('100 MB'); // ~100 MB video file
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB'); // ~1.5 GB video file
  });

  test('handles progress update sizes', () => {
    // Simulate typical download progress sizes
    expect(formatBytes(0)).toBe('0 Bytes'); // Start
    expect(formatBytes(256 * 1024)).toBe('256 KB'); // Partial download
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB'); // Mid download
    expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB'); // Large download
  });
});

