const { analyzeAndGroupVideos } = require('../src/video-grouping');
const { 
  loadPreferences, 
  savePreferences, 
  addRecentPattern,
  applyDateTokens,
  DEFAULT_PREFERENCES 
} = require('../src/preferences');

describe('Video Merge Workflow Integration', () => {
  describe('Grouping with preferences', () => {
    test('groups videos and applies filename pattern from preferences', () => {
      // Setup: files from same session
      const files = [
        '/videos/session1/GX010001.MP4',
        '/videos/session1/GX020001.MP4',
        '/videos/session1/GX030001.MP4'
      ];

      // Analyze and group
      const groups = analyzeAndGroupVideos(files);

      // Verify grouping
      expect(groups).toHaveLength(1);
      expect(groups[0].sessionId).toBe('0001');
      expect(groups[0].files).toHaveLength(3);

      // Apply preferences pattern
      const prefs = { 
        ...DEFAULT_PREFERENCES,
        lastUsedPattern: 'GoPro_{date}_{sessionId}'
      };
      
      const pattern = prefs.lastUsedPattern;
      const sessionId = groups[0].sessionId;
      
      // Verify pattern can be applied
      expect(pattern).toContain('{date}');
      expect(sessionId).toBe('0001');
    });

    test('handles multiple sessions with different patterns', () => {
      const files = [
        '/videos/morning/GX010001.MP4',
        '/videos/morning/GX020001.MP4',
        '/videos/afternoon/GX010002.MP4',
        '/videos/afternoon/GX020002.MP4'
      ];

      const groups = analyzeAndGroupVideos(files);

      expect(groups).toHaveLength(2);
      
      const session1 = groups.find(g => g.sessionId === '0001');
      const session2 = groups.find(g => g.sessionId === '0002');

      expect(session1).toBeDefined();
      expect(session1.files).toHaveLength(2);
      expect(session1.directory).toContain('morning');

      expect(session2).toBeDefined();
      expect(session2.files).toHaveLength(2);
      expect(session2.directory).toContain('afternoon');
    });
  });

  describe('Preferences workflow', () => {
    test('adds pattern and retrieves it', () => {
      let prefs = { ...DEFAULT_PREFERENCES };
      
      // Add a pattern
      prefs = addRecentPattern(prefs, 'MyVideo_{date}');
      
      expect(prefs.recentFilenamePatterns).toContain('MyVideo_{date}');
      expect(prefs.lastUsedPattern).toBe('MyVideo_{date}');
    });

    test('applies date tokens to generate final filename', () => {
      const pattern = 'GoPro_{year}_{month}_{day}_Session_{sessionId}';
      const date = new Date(2024, 0, 15); // Jan 15, 2024
      
      let result = applyDateTokens(pattern, date);
      
      // Should replace date tokens
      expect(result).toContain('2024');
      expect(result).toContain('01');
      expect(result).toContain('15');
      expect(result).toContain('Session_{sessionId}'); // sessionId not replaced by applyDateTokens
    });

    test('complete workflow: group videos, apply preferences, generate filename', () => {
      // Step 1: Group videos
      const files = [
        '/videos/trip/GX010001.MP4',
        '/videos/trip/GX020001.MP4'
      ];
      
      const groups = analyzeAndGroupVideos(files);
      expect(groups).toHaveLength(1);
      
      const group = groups[0];
      
      // Step 2: Load preferences
      let prefs = { ...DEFAULT_PREFERENCES };
      prefs = addRecentPattern(prefs, 'Trip_{date}_Session{sessionId}');
      
      // Step 3: Apply pattern
      const pattern = prefs.lastUsedPattern;
      const date = new Date(2024, 0, 15);
      let filename = applyDateTokens(pattern, date);
      
      // Step 4: Replace session ID manually (as would be done in renderer)
      filename = filename.replace('{sessionId}', group.sessionId);
      
      // Verify final filename
      expect(filename).toContain('Trip_2024-01-15');
      expect(filename).toContain('Session0001');
      expect(filename).not.toContain('{');
    });
  });

  describe('Error handling', () => {
    test('handles empty file list', () => {
      const groups = analyzeAndGroupVideos([]);
      expect(groups).toHaveLength(0);
    });

    test('handles non-GoPro files', () => {
      const files = [
        '/videos/random1.mp4',
        '/videos/random2.mov',
        '/videos/test.avi'
      ];
      
      const groups = analyzeAndGroupVideos(files);
      expect(groups).toHaveLength(0);
    });

    test('handles mixed GoPro and non-GoPro files', () => {
      const files = [
        '/videos/GX010001.MP4',
        '/videos/random.mp4',
        '/videos/GX020001.MP4',
        '/videos/test.mov'
      ];
      
      const groups = analyzeAndGroupVideos(files);
      expect(groups).toHaveLength(1);
      expect(groups[0].files).toHaveLength(2);
      expect(groups[0].files).not.toContain('/videos/random.mp4');
    });

    test('handles invalid pattern in preferences', () => {
      let prefs = { ...DEFAULT_PREFERENCES };
      
      // Try to add empty pattern
      prefs = addRecentPattern(prefs, '');
      expect(prefs.recentFilenamePatterns.length).toBe(0);
      
      // Try to add null pattern
      prefs = addRecentPattern(prefs, null);
      expect(prefs.recentFilenamePatterns.length).toBe(0);
    });
  });

  describe('Complex scenarios', () => {
    test('handles videos from multiple directories with same session ID', () => {
      const files = [
        '/videos/camera1/GX010001.MP4',
        '/videos/camera1/GX020001.MP4',
        '/videos/camera2/GX010001.MP4',
        '/videos/camera2/GX020001.MP4'
      ];
      
      const groups = analyzeAndGroupVideos(files);
      
      // Should create separate groups for different directories
      expect(groups).toHaveLength(2);
      
      const camera1Group = groups.find(g => g.directory.includes('camera1'));
      const camera2Group = groups.find(g => g.directory.includes('camera2'));
      
      expect(camera1Group).toBeDefined();
      expect(camera2Group).toBeDefined();
      expect(camera1Group.files).toHaveLength(2);
      expect(camera2Group.files).toHaveLength(2);
    });

    test('maintains pattern history limit', () => {
      let prefs = {
        ...DEFAULT_PREFERENCES,
        maxRecentPatterns: 3,
        recentFilenamePatterns: []
      };
      
      // Add 5 patterns
      prefs = addRecentPattern(prefs, 'Pattern1');
      prefs = addRecentPattern(prefs, 'Pattern2');
      prefs = addRecentPattern(prefs, 'Pattern3');
      prefs = addRecentPattern(prefs, 'Pattern4');
      prefs = addRecentPattern(prefs, 'Pattern5');
      
      // Should only keep last 3
      expect(prefs.recentFilenamePatterns).toHaveLength(3);
      expect(prefs.recentFilenamePatterns).toContain('Pattern5');
      expect(prefs.recentFilenamePatterns).toContain('Pattern4');
      expect(prefs.recentFilenamePatterns).toContain('Pattern3');
      expect(prefs.recentFilenamePatterns).not.toContain('Pattern1');
    });

    test('handles pattern with multiple date formats', () => {
      const patterns = [
        'Video_{date}',
        'Video_{year}_{month}_{day}',
        'Video_{day}-{month}-{year}'
      ];
      
      const date = new Date(2024, 0, 15);
      
      patterns.forEach(pattern => {
        const result = applyDateTokens(pattern, date);
        expect(result).not.toContain('{date}');
        expect(result).not.toContain('{year}');
        expect(result).not.toContain('{month}');
        expect(result).not.toContain('{day}');
      });
    });
  });
});
