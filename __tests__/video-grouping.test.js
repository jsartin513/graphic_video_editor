const { extractSessionId, derivePatternFromFilename, analyzeAndGroupVideos } = require('../src/video-grouping');
const path = require('path');

describe('extractSessionId', () => {
  test('extracts session ID from GX pattern (original digit format)', () => {
    // Original format: GX + 2 digits (sequence) + 4 digits (session ID)
    expect(extractSessionId('GX010001.MP4')).toBe('0001');
    expect(extractSessionId('GX121234.MP4')).toBe('1234');
    expect(extractSessionId('GX999999.MP4')).toBe('9999');
    expect(extractSessionId('GX000000.MP4')).toBe('0000');
  });

  test('extracts session ID from GXAA format (letter sequence)', () => {
    // GXAA format: GX + 2 letters + 4 digits (session ID)
    expect(extractSessionId('GXAA0123.MP4')).toBe('0123');
    expect(extractSessionId('GXAA0223.MP4')).toBe('0223');
    expect(extractSessionId('GXAB1234.MP4')).toBe('1234');
    expect(extractSessionId('GXZZ9999.MP4')).toBe('9999');
  });

  test('extracts session ID from GX mixed alphanumeric format', () => {
    // GX + 2 alphanumeric + 4 digits (mixed letters/digits)
    expect(extractSessionId('GX0A0123.MP4')).toBe('0123');
    expect(extractSessionId('GXA10001.MP4')).toBe('0001');
    expect(extractSessionId('GX1B1234.MP4')).toBe('1234');
  });

  test('extracts session ID from GP pattern (original and letter formats)', () => {
    // Original: GP + 2 digits
    expect(extractSessionId('GP010001.MP4')).toBe('0001');
    expect(extractSessionId('GP121234.MP4')).toBe('1234');
    // GP + 2 letters (same extension as GX)
    expect(extractSessionId('GPAA0123.MP4')).toBe('0123');
  });

  test('extracts session ID from GOPR pattern', () => {
    expect(extractSessionId('GOPR0001.MP4')).toBe('0001');
    expect(extractSessionId('GOPR1234.MP4')).toBe('1234');
  });

  test('is backward compatible with all original formats', () => {
    // Ensure no regression: original GX01, GP01, GOPR formats unchanged
    expect(extractSessionId('GX010001.MP4')).toBe('0001');
    expect(extractSessionId('GX020001.MP4')).toBe('0001');
    expect(extractSessionId('GX030001.MP4')).toBe('0001');
    expect(extractSessionId('GP010001.MP4')).toBe('0001');
    expect(extractSessionId('GOPR0001.MP4')).toBe('0001');
  });

  test('is case insensitive', () => {
    expect(extractSessionId('gx010001.mp4')).toBe('0001');
    expect(extractSessionId('gxaa0123.mp4')).toBe('0123');
    expect(extractSessionId('GOPR0001.mp4')).toBe('0001');
    expect(extractSessionId('gopr0001.MP4')).toBe('0001');
  });

  test('returns null for non-GoPro files', () => {
    expect(extractSessionId('video.mp4')).toBeNull();
    expect(extractSessionId('test.MP4')).toBeNull();
    expect(extractSessionId('GX123.MP4')).toBeNull(); // Too short
    expect(extractSessionId('GX1.MP4')).toBeNull(); // No session ID
  });
});

describe('derivePatternFromFilename', () => {
  test('derives pattern with {sessionId} from GX filenames', () => {
    expect(derivePatternFromFilename('GX010001.MP4')).toBe('GX01{sessionId}');
    expect(derivePatternFromFilename('GXAA0123.MP4')).toBe('GXAA{sessionId}');
    expect(derivePatternFromFilename('GXAB1234.MP4')).toBe('GXAB{sessionId}');
    expect(derivePatternFromFilename('GX0A0001.MP4')).toBe('GX0A{sessionId}');
  });
  test('derives pattern with {sessionId} from GP and GOPR filenames', () => {
    expect(derivePatternFromFilename('GP010001.MP4')).toBe('GP01{sessionId}');
    expect(derivePatternFromFilename('GPAA0123.MP4')).toBe('GPAA{sessionId}');
    expect(derivePatternFromFilename('GOPR0001.MP4')).toBe('GOPR{sessionId}');
  });
  test('returns null for non-GoPro files', () => {
    expect(derivePatternFromFilename('video.mp4')).toBeNull();
    expect(derivePatternFromFilename('test.MP4')).toBeNull();
    expect(derivePatternFromFilename('GX123.MP4')).toBeNull();
  });
});

describe('analyzeAndGroupVideos', () => {
  test('groups files by session ID from same directory', () => {
    const filePaths = [
      '/videos/folder1/GX010001.MP4',
      '/videos/folder1/GX020001.MP4',
      '/videos/folder1/GX030001.MP4',
    ];

    const result = analyzeAndGroupVideos(filePaths);

    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe('0001');
    expect(result[0].directory).toBe('/videos/folder1');
    expect(result[0].files).toHaveLength(3);
    expect(result[0].outputFilename).toBe('PROCESSED0001.MP4');
  });

  test('separates files with same session ID from different directories', () => {
    const filePaths = [
      '/videos/folder1/GX010001.MP4',
      '/videos/folder1/GX020001.MP4',
      '/videos/folder2/GX010001.MP4',
      '/videos/folder2/GX020001.MP4',
    ];

    const result = analyzeAndGroupVideos(filePaths);

    expect(result).toHaveLength(2); // Two separate groups
    
    // Both should have session ID 0001 but different directories
    const folder1Group = result.find(g => g.directory === '/videos/folder1');
    const folder2Group = result.find(g => g.directory === '/videos/folder2');

    expect(folder1Group).toBeDefined();
    expect(folder1Group.sessionId).toBe('0001');
    expect(folder1Group.files).toHaveLength(2);
    
    expect(folder2Group).toBeDefined();
    expect(folder2Group.sessionId).toBe('0001');
    expect(folder2Group.files).toHaveLength(2);

    // Should include directory name in output filename to differentiate
    expect(folder1Group.outputFilename).toContain('folder1');
    expect(folder2Group.outputFilename).toContain('folder2');
  });

  test('groups different session IDs separately', () => {
    const filePaths = [
      '/videos/folder1/GX010001.MP4',
      '/videos/folder1/GX020001.MP4',
      '/videos/folder1/GX010002.MP4',
      '/videos/folder1/GX020002.MP4',
    ];

    const result = analyzeAndGroupVideos(filePaths);

    expect(result).toHaveLength(2);
    
    const session1 = result.find(g => g.sessionId === '0001');
    const session2 = result.find(g => g.sessionId === '0002');

    expect(session1).toBeDefined();
    expect(session1.files).toHaveLength(2);
    
    expect(session2).toBeDefined();
    expect(session2.files).toHaveLength(2);
  });

  test('skips non-GoPro files', () => {
    const filePaths = [
      '/videos/folder1/GX010001.MP4',
      '/videos/folder1/regular-video.mp4',
      '/videos/folder1/GX020001.MP4',
      '/videos/folder1/test.MOV',
    ];

    const result = analyzeAndGroupVideos(filePaths);

    expect(result).toHaveLength(1);
    expect(result[0].files).toHaveLength(2); // Only GoPro files included
    expect(result[0].files.every(f => f.includes('GX'))).toBe(true);
  });

  test('sorts files within each group', () => {
    const filePaths = [
      '/videos/folder1/GX030001.MP4',
      '/videos/folder1/GX010001.MP4',
      '/videos/folder1/GX020001.MP4',
    ];

    const result = analyzeAndGroupVideos(filePaths);

    expect(result).toHaveLength(1);
    expect(result[0].files).toEqual([
      '/videos/folder1/GX010001.MP4',
      '/videos/folder1/GX020001.MP4',
      '/videos/folder1/GX030001.MP4',
    ]);
  });

  test('sorts groups by directory then session ID', () => {
    const filePaths = [
      '/videos/folder2/GX010002.MP4',
      '/videos/folder1/GX010002.MP4',
      '/videos/folder1/GX010001.MP4',
      '/videos/folder2/GX010001.MP4',
    ];

    const result = analyzeAndGroupVideos(filePaths);

    expect(result).toHaveLength(4);
    
    // Should be sorted: folder1/0001, folder1/0002, folder2/0001, folder2/0002
    expect(result[0].directory).toBe('/videos/folder1');
    expect(result[0].sessionId).toBe('0001');
    expect(result[1].directory).toBe('/videos/folder1');
    expect(result[1].sessionId).toBe('0002');
    expect(result[2].directory).toBe('/videos/folder2');
    expect(result[2].sessionId).toBe('0001');
    expect(result[3].directory).toBe('/videos/folder2');
    expect(result[3].sessionId).toBe('0002');
  });

  test('handles Windows-style paths', () => {
    // Use forward slashes for Windows paths in Node.js (path module handles conversion)
    const filePaths = [
      'C:/Videos/folder1/GX010001.MP4',
      'C:/Videos/folder1/GX020001.MP4',
      'C:/Videos/folder2/GX010001.MP4',
    ];

    const result = analyzeAndGroupVideos(filePaths);

    expect(result).toHaveLength(2);
    const folder1Group = result.find(g => g.directory.includes('folder1'));
    const folder2Group = result.find(g => g.directory.includes('folder2'));
    expect(folder1Group).toBeDefined();
    expect(folder1Group.files).toHaveLength(2);
    expect(folder2Group).toBeDefined();
    expect(folder2Group.files).toHaveLength(1);
  });

  test('sanitizes directory names in output filename', () => {
    const filePaths = [
      '/videos/my folder/GX010001.MP4',
      '/videos/my-folder/GX010001.MP4',
    ];

    const result = analyzeAndGroupVideos(filePaths);

    expect(result).toHaveLength(2);
    // Directory names with spaces should be sanitized
    const folderWithSpace = result.find(g => g.directory.includes('my folder'));
    expect(folderWithSpace.outputFilename).toMatch(/my_folder/);
  });

  test('handles empty input', () => {
    const result = analyzeAndGroupVideos([]);
    expect(result).toHaveLength(0);
  });

  test('handles files with no valid GoPro patterns', () => {
    const filePaths = [
      '/videos/folder1/video1.mp4',
      '/videos/folder1/video2.mov',
    ];

    const result = analyzeAndGroupVideos(filePaths);
    expect(result).toHaveLength(0);
  });

  test('groups GX format files by session ID (session 0123)', () => {
    // GX + 2 alphanumeric + 4 digits (session). Clips 01, 02, 03 same session.
    const filePaths = [
      '/videos/folder1/GX010123.MP4',
      '/videos/folder1/GX020123.MP4',
      '/videos/folder1/GX030123.MP4',
    ];

    const result = analyzeAndGroupVideos(filePaths);

    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe('0123');
    expect(result[0].directory).toBe('/videos/folder1');
    expect(result[0].files).toHaveLength(3);
    expect(result[0].outputFilename).toBe('PROCESSED0123.MP4');
  });

  test('groups GXAA format files (user format GXAA0123, GXAA0223)', () => {
    // GXAA: GX + 2 letters + 4 digits. Each file is a separate session.
    const filePaths = [
      '/videos/folder1/GXAA0123.MP4',
      '/videos/folder1/GXAA0223.MP4',
    ];

    const result = analyzeAndGroupVideos(filePaths);

    expect(result).toHaveLength(2);
    expect(result[0].sessionId).toBe('0123');
    expect(result[0].files).toHaveLength(1);
    expect(result[1].sessionId).toBe('0223');
    expect(result[1].files).toHaveLength(1);
  });

  test('groups GXAA and GX01 format together when same session', () => {
    // Both GXAA0001 and GX010001 extract session 0001
    const filePaths = [
      '/videos/folder1/GXAA0001.MP4',
      '/videos/folder1/GX010001.MP4',
      '/videos/folder1/GX020001.MP4',
    ];

    const result = analyzeAndGroupVideos(filePaths);

    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe('0001');
    expect(result[0].files).toHaveLength(3);
  });

  test('separates sessions by session ID (GX format multi-clip)', () => {
    // GX010123/GX020123 = session 0123; GX010223/GX020223 = session 0223
    const filePaths = [
      '/videos/folder1/GX010123.MP4',
      '/videos/folder1/GX020123.MP4',
      '/videos/folder1/GX010223.MP4',
      '/videos/folder1/GX020223.MP4',
    ];

    const result = analyzeAndGroupVideos(filePaths);

    expect(result).toHaveLength(2);
    const session123 = result.find(g => g.sessionId === '0123');
    const session223 = result.find(g => g.sessionId === '0223');
    expect(session123).toBeDefined();
    expect(session123.files).toHaveLength(2);
    expect(session223).toBeDefined();
    expect(session223.files).toHaveLength(2);
  });
});

