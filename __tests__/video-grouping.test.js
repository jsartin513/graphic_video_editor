const { extractSessionId, analyzeAndGroupVideos } = require('../src/video-grouping');
const path = require('path');

describe('extractSessionId', () => {
  test('extracts session ID from GX pattern', () => {
    // GX pattern: GX + 2 digits (sequence) + 4 digits (session ID)
    expect(extractSessionId('GX010001.MP4')).toBe('0001');
    expect(extractSessionId('GX121234.MP4')).toBe('1234');
    expect(extractSessionId('GX999999.MP4')).toBe('9999');
  });

  test('extracts session ID from GP pattern', () => {
    // GP pattern: GP + 2 digits (sequence) + 4 digits (session ID)
    expect(extractSessionId('GP010001.MP4')).toBe('0001');
    expect(extractSessionId('GP121234.MP4')).toBe('1234');
  });

  test('extracts session ID from GOPR pattern', () => {
    expect(extractSessionId('GOPR0001.MP4')).toBe('0001');
    expect(extractSessionId('GOPR1234.MP4')).toBe('1234');
  });

  test('is case insensitive', () => {
    expect(extractSessionId('gx010001.mp4')).toBe('0001');
    expect(extractSessionId('GOPR0001.mp4')).toBe('0001');
    expect(extractSessionId('gopr0001.MP4')).toBe('0001');
  });

  test('returns null for non-GoPro files', () => {
    expect(extractSessionId('video.mp4')).toBeNull();
    expect(extractSessionId('test.MP4')).toBeNull();
    expect(extractSessionId('GX123.MP4')).toBeNull(); // Too short
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
});

