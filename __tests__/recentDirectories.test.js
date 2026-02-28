/**
 * Tests for recent directories functionality in preferences module
 */

const {
  addRecentDirectory,
  pinDirectory,
  unpinDirectory,
  clearRecentDirectories,
  cleanupDirectories,
  DEFAULT_PREFERENCES
} = require('../src/preferences');

describe('Recent Directories', () => {
  let mockPreferences;

  beforeEach(() => {
    mockPreferences = {
      ...DEFAULT_PREFERENCES,
      recentDirectories: [],
      pinnedDirectories: []
    };
  });

  describe('addRecentDirectory', () => {
    test('should add a new directory to recent list', () => {
      const result = addRecentDirectory(mockPreferences, '/path/to/videos');
      
      expect(result.recentDirectories).toHaveLength(1);
      expect(result.recentDirectories[0].path).toBe('/path/to/videos');
      expect(result.recentDirectories[0].lastUsed).toBeDefined();
    });

    test('should move existing directory to front', () => {
      mockPreferences.recentDirectories = [
        { path: '/path/one', lastUsed: '2024-01-01T00:00:00.000Z' },
        { path: '/path/two', lastUsed: '2024-01-02T00:00:00.000Z' }
      ];

      const result = addRecentDirectory(mockPreferences, '/path/one');
      
      expect(result.recentDirectories).toHaveLength(2);
      expect(result.recentDirectories[0].path).toBe('/path/one');
      expect(result.recentDirectories[1].path).toBe('/path/two');
    });

    test('should not add directory if it is pinned', () => {
      mockPreferences.pinnedDirectories = [
        { path: '/pinned/path', pinnedAt: '2024-01-01T00:00:00.000Z' }
      ];

      const result = addRecentDirectory(mockPreferences, '/pinned/path');
      
      expect(result.recentDirectories).toHaveLength(0);
    });

    test('should respect maxRecentDirectories limit', () => {
      mockPreferences.maxRecentDirectories = 3;
      mockPreferences.recentDirectories = [
        { path: '/path/one', lastUsed: '2024-01-01T00:00:00.000Z' },
        { path: '/path/two', lastUsed: '2024-01-02T00:00:00.000Z' },
        { path: '/path/three', lastUsed: '2024-01-03T00:00:00.000Z' }
      ];

      const result = addRecentDirectory(mockPreferences, '/path/four');
      
      expect(result.recentDirectories).toHaveLength(3);
      expect(result.recentDirectories[0].path).toBe('/path/four');
      expect(result.recentDirectories.find(d => d.path === '/path/one')).toBeUndefined();
    });

    test('should handle invalid inputs gracefully', () => {
      expect(addRecentDirectory(mockPreferences, null)).toEqual(mockPreferences);
      expect(addRecentDirectory(mockPreferences, '')).toEqual(mockPreferences);
      expect(addRecentDirectory(mockPreferences, 123)).toEqual(mockPreferences);
    });
  });

  describe('pinDirectory', () => {
    test('should pin a directory', () => {
      const result = pinDirectory(mockPreferences, '/path/to/pin');
      
      expect(result.pinnedDirectories).toHaveLength(1);
      expect(result.pinnedDirectories[0].path).toBe('/path/to/pin');
      expect(result.pinnedDirectories[0].pinnedAt).toBeDefined();
    });

    test('should remove from recent when pinning', () => {
      mockPreferences.recentDirectories = [
        { path: '/path/to/pin', lastUsed: '2024-01-01T00:00:00.000Z' }
      ];

      const result = pinDirectory(mockPreferences, '/path/to/pin');
      
      expect(result.pinnedDirectories).toHaveLength(1);
      expect(result.recentDirectories).toHaveLength(0);
    });

    test('should not add duplicate pins', () => {
      mockPreferences.pinnedDirectories = [
        { path: '/already/pinned', pinnedAt: '2024-01-01T00:00:00.000Z' }
      ];

      const result = pinDirectory(mockPreferences, '/already/pinned');
      
      expect(result.pinnedDirectories).toHaveLength(1);
    });

    test('should handle invalid inputs gracefully', () => {
      expect(pinDirectory(mockPreferences, null)).toEqual(mockPreferences);
      expect(pinDirectory(mockPreferences, '')).toEqual(mockPreferences);
    });
  });

  describe('unpinDirectory', () => {
    test('should unpin a directory', () => {
      mockPreferences.pinnedDirectories = [
        { path: '/pinned/one', pinnedAt: '2024-01-01T00:00:00.000Z' },
        { path: '/pinned/two', pinnedAt: '2024-01-02T00:00:00.000Z' }
      ];

      const result = unpinDirectory(mockPreferences, '/pinned/one');
      
      expect(result.pinnedDirectories).toHaveLength(1);
      expect(result.pinnedDirectories[0].path).toBe('/pinned/two');
    });

    test('should handle unpinning non-existent directory', () => {
      const result = unpinDirectory(mockPreferences, '/not/pinned');
      
      expect(result.pinnedDirectories).toHaveLength(0);
    });
  });

  describe('clearRecentDirectories', () => {
    test('should clear all recent directories', () => {
      mockPreferences.recentDirectories = [
        { path: '/path/one', lastUsed: '2024-01-01T00:00:00.000Z' },
        { path: '/path/two', lastUsed: '2024-01-02T00:00:00.000Z' }
      ];

      const result = clearRecentDirectories(mockPreferences);
      
      expect(result.recentDirectories).toHaveLength(0);
    });

    test('should not affect pinned directories', () => {
      mockPreferences.pinnedDirectories = [
        { path: '/pinned/path', pinnedAt: '2024-01-01T00:00:00.000Z' }
      ];
      mockPreferences.recentDirectories = [
        { path: '/recent/path', lastUsed: '2024-01-01T00:00:00.000Z' }
      ];

      const result = clearRecentDirectories(mockPreferences);
      
      expect(result.recentDirectories).toHaveLength(0);
      expect(result.pinnedDirectories).toHaveLength(1);
    });
  });

  describe('cleanupDirectories', () => {
    test('should remove non-existent directories from recent list', async () => {
      mockPreferences.recentDirectories = [
        { path: '/exists', lastUsed: '2024-01-01T00:00:00.000Z' },
        { path: '/does-not-exist', lastUsed: '2024-01-02T00:00:00.000Z' }
      ];

      const existsCheck = async (path) => path === '/exists';
      const result = await cleanupDirectories(mockPreferences, existsCheck);
      
      expect(result.recentDirectories).toHaveLength(1);
      expect(result.recentDirectories[0].path).toBe('/exists');
    });

    test('should remove non-existent directories from pinned list', async () => {
      mockPreferences.pinnedDirectories = [
        { path: '/exists', pinnedAt: '2024-01-01T00:00:00.000Z' },
        { path: '/does-not-exist', pinnedAt: '2024-01-02T00:00:00.000Z' }
      ];

      const existsCheck = async (path) => path === '/exists';
      const result = await cleanupDirectories(mockPreferences, existsCheck);
      
      expect(result.pinnedDirectories).toHaveLength(1);
      expect(result.pinnedDirectories[0].path).toBe('/exists');
    });

    test('should handle empty lists', async () => {
      const existsCheck = async () => true;
      const result = await cleanupDirectories(mockPreferences, existsCheck);
      
      expect(result.recentDirectories).toHaveLength(0);
      expect(result.pinnedDirectories).toHaveLength(0);
    });
  });
});
