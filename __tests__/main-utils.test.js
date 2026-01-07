const { formatFileSize } = require('../src/main-utils');

describe('formatFileSize', () => {
  test('formats 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
  });

  test('formats bytes (less than 1 KB)', () => {
    expect(formatFileSize(500)).toBe('500 Bytes');
    expect(formatFileSize(1023)).toBe('1023 Bytes');
  });

  test('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  test('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1 MB');
    expect(formatFileSize(2097152)).toBe('2 MB');
    expect(formatFileSize(1572864)).toBe('1.5 MB');
  });

  test('formats gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1 GB');
    expect(formatFileSize(2147483648)).toBe('2 GB');
    expect(formatFileSize(1610612736)).toBe('1.5 GB');
  });

  test('rounds to 2 decimal places', () => {
    expect(formatFileSize(1234567)).toBe('1.18 MB');
    expect(formatFileSize(987654321)).toBe('941.9 MB');
  });

  test('handles large file sizes', () => {
    expect(formatFileSize(5368709120)).toBe('5 GB');
  });

  test('handles very small files (1 byte)', () => {
    expect(formatFileSize(1)).toBe('1 Bytes');
  });

  test('handles exact boundaries', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1048576)).toBe('1 MB');
    expect(formatFileSize(1073741824)).toBe('1 GB');
  });
});
