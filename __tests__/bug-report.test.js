/**
 * Tests for src/bug-report.js
 */

const os = require('os');

jest.mock('os', () => {
  const actual = jest.requireActual('os');
  return {
    ...actual,
    homedir: jest.fn(() => '/Users/testuser'),
    userInfo: jest.fn(() => ({ username: 'testuser' })),
    release: jest.fn(() => '24.0.0'),
    version: jest.fn(() => 'Darwin Kernel Version 24.0.0')
  };
});

const {
  redactPaths,
  buildIssueTitle,
  buildIssueBody,
  buildGitHubIssueUrl,
  collectSystemInfo,
  truncateBodyForUrl
} = require('../src/bug-report');

describe('bug-report', () => {
  describe('redactPaths', () => {
    it('redacts home directory', () => {
      const text = 'Failed at /Users/testuser/Videos/clip.mp4';
      expect(redactPaths(text, '/Users/testuser')).toBe('Failed at ~/Videos/clip.mp4');
    });
  });

  describe('buildIssueTitle', () => {
    it('uses user description first line', () => {
      expect(buildIssueTitle({ userDescription: 'Merge failed\nmore' })).toBe('Bug: Merge failed');
    });

    it('falls back to error userMessage', () => {
      expect(buildIssueTitle({ errorInfo: { userMessage: 'Disk full' } })).toBe('Bug: Disk full');
    });

    it('uses default title when empty', () => {
      expect(buildIssueTitle({})).toBe('Bug report from Video Merger');
    });
  });

  describe('buildIssueBody', () => {
    it('includes system info and error block', () => {
      const body = buildIssueBody(
        {
          version: '1.3.2',
          isPackaged: true,
          osVersion: 'Darwin 24',
          arch: 'arm64',
          electronVersion: '28.0.0',
          debugMode: false
        },
        {
          userDescription: 'Something broke',
          errorInfo: {
            userMessage: 'Merge failed',
            code: 'FFMPEG_ERROR',
            technicalDetails: 'ffmpeg exited 1'
          },
          logTail: '[ERROR] test'
        }
      );
      expect(body).toContain('Something broke');
      expect(body).toContain('**App version:** 1.3.2');
      expect(body).toContain('FFMPEG_ERROR');
      expect(body).toContain('Recent logs');
    });
  });

  describe('buildGitHubIssueUrl', () => {
    it('includes bug label and encoded title', () => {
      const url = buildGitHubIssueUrl('Bug: test', 'Body here');
      expect(url).toContain('github.com/jsartin513/graphic_video_editor/issues/new');
      expect(url).toContain('labels=bug');
      expect(url).toContain('title=');
      expect(url).toContain('body=');
    });
  });

  describe('truncateBodyForUrl', () => {
    it('truncates very long bodies', () => {
      const long = 'x'.repeat(5000);
      const result = truncateBodyForUrl(long);
      expect(result.length).toBeLessThan(long.length);
      expect(result).toContain('truncated');
    });
  });

  describe('collectSystemInfo', () => {
    it('reads app version and packaged flag', () => {
      const info = collectSystemInfo(
        {
          app: { getVersion: () => '2.0.0', isPackaged: true },
          process: { arch: 'arm64', versions: { electron: '30.0.0' } }
        },
        true
      );
      expect(info.version).toBe('2.0.0');
      expect(info.isPackaged).toBe(true);
      expect(info.debugMode).toBe(true);
    });
  });
});
