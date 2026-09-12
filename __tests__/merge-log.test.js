const path = require('path');
const fs = require('fs').promises;

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      mkdir: jest.fn(),
      appendFile: jest.fn()
    }
  };
});

const {
  MERGE_LOG_FILENAME,
  createMergeLogEntry,
  buildMergeLogEntryForCompletedMerge,
  appendMergeLogEntry
} = require('../src/merge-log');

describe('merge-log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.mkdir.mockResolvedValue(undefined);
    fs.appendFile.mockResolvedValue(undefined);
  });

  describe('createMergeLogEntry', () => {
    test('builds entry with timestamp, settings, and naming', () => {
      const entry = createMergeLogEntry({
        sessionId: '0534',
        inputFiles: ['/a/GX010534.MP4'],
        outputPath: '/out/merged_videos/BDL Open Gym 2026-09-12.mp4',
        outputFilename: 'BDL Open Gym 2026-09-12.mp4',
        outputDir: '/out/merged_videos',
        settings: { quality: 'copy', format: 'mp4', normalizeAudio: false },
        naming: {
          templateName: 'BDL Open Gym',
          templatePattern: 'BDL Open Gym {date}',
          weekCount: '3',
          dateFormat: 'YYYY-MM-DD'
        }
      });

      expect(entry.type).toBe('merge');
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(entry.sessionId).toBe('0534');
      expect(entry.outputPath).toContain('BDL Open Gym');
      expect(entry.settings).toEqual({ quality: 'copy', format: 'mp4', normalizeAudio: false });
      expect(entry.naming.templateName).toBe('BDL Open Gym');
      expect(entry.naming.weekCount).toBe('3');
    });

    test('throws when outputPath is missing', () => {
      expect(() => createMergeLogEntry({ inputFiles: [] })).toThrow(/outputPath/);
    });

    test('omits empty naming fields', () => {
      const entry = createMergeLogEntry({
        outputPath: '/out/x.mp4',
        inputFiles: [],
        naming: { templateName: '', weekCount: '  ' }
      });
      expect(entry.naming).toBeUndefined();
    });
  });

  describe('buildMergeLogEntryForCompletedMerge', () => {
    it('uses merge handler paths and settings with optional naming context', () => {
      const entry = buildMergeLogEntryForCompletedMerge({
        filePaths: ['/in/a.mp4', '/in/b.mp4'],
        outputPath: '/out/merged_videos/session.mp4',
        qualityOption: 'copy',
        format: 'mp4',
        normalizeAudio: false,
        mergeLogContext: {
          sessionId: '0534',
          naming: { templateName: 'BDL Open Gym', dateFormat: 'YYYY-MM-DD' }
        }
      });
      expect(entry.inputFiles).toEqual(['/in/a.mp4', '/in/b.mp4']);
      expect(entry.outputPath).toBe('/out/merged_videos/session.mp4');
      expect(entry.settings).toEqual({ quality: 'copy', format: 'mp4', normalizeAudio: false });
      expect(entry.sessionId).toBe('0534');
      expect(entry.naming.templateName).toBe('BDL Open Gym');
    });
  });

  describe('appendMergeLogEntry', () => {
    test('appends JSON line to merge_log.jsonl', async () => {
      const outputDir = path.join('/Users', 'me', 'court1', 'merged_videos');
      const entry = { type: 'merge', timestamp: '2026-09-12T12:00:00.000Z', outputPath: '/x.mp4', inputFiles: [] };

      const result = await appendMergeLogEntry(outputDir, entry);

      expect(fs.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true });
      expect(fs.appendFile).toHaveBeenCalledWith(
        path.join(outputDir, MERGE_LOG_FILENAME),
        `${JSON.stringify(entry)}\n`,
        'utf8'
      );
      expect(result.logPath).toBe(path.join(outputDir, MERGE_LOG_FILENAME));
    });

    test('rejects relative output directory', async () => {
      await expect(appendMergeLogEntry('relative/dir', { outputPath: '/x.mp4', inputFiles: [] }))
        .rejects.toThrow(/Invalid output directory/);
    });
  });
});
