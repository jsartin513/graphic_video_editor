const {
  bundledBinaryFileName,
  getBinaryDownloadUrl,
  shouldDownloadBinaries,
  resolveTargetPlatform
} = require('../src/ffmpeg-binary-utils');

describe('ffmpeg-binary-utils', () => {
  test('bundledBinaryFileName adds .exe on win32', () => {
    expect(bundledBinaryFileName('ffmpeg', 'win32')).toBe('ffmpeg.exe');
    expect(bundledBinaryFileName('ffmpeg', 'darwin')).toBe('ffmpeg');
  });

  test('getBinaryDownloadUrl returns platform-specific URLs', () => {
    expect(getBinaryDownloadUrl('ffmpeg', 'x64', 'darwin')).toContain('ffmpeg-darwin-x64.gz');
    expect(getBinaryDownloadUrl('ffmpeg', 'x64', 'win32')).toContain('ffmpeg-win32-x64.exe.gz');
  });

  test('shouldDownloadBinaries when cross-platform', () => {
    expect(shouldDownloadBinaries('win32', 'x64')).toBe(process.platform !== 'win32');
  });

  test('resolveTargetPlatform honors TARGET_PLATFORM', () => {
    const prev = process.env.TARGET_PLATFORM;
    process.env.TARGET_PLATFORM = 'win32';
    expect(resolveTargetPlatform()).toBe('win32');
    process.env.TARGET_PLATFORM = prev;
  });
});
