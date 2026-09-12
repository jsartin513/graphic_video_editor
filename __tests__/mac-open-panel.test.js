jest.mock('child_process', () => ({
  execFile: jest.fn()
}));

const { execFile } = require('child_process');
const { chooseFiles, chooseFolder, escapeAppleScriptString } = require('../main/mac-open-panel');

function mockExecFileSuccess(stdout) {
  execFile.mockImplementation((file, args, options, callback) => {
    callback(null, stdout, '');
  });
}

function mockExecFileCanceled() {
  execFile.mockImplementation((file, args, options, callback) => {
    const err = new Error('User canceled');
    err.code = 1;
    err.stderr = 'User canceled. (-128)';
    callback(err);
  });
}

describe('mac-open-panel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('escapeAppleScriptString escapes quotes and backslashes', () => {
    expect(escapeAppleScriptString('Say "hi"')).toBe('Say \\"hi\\"');
    expect(escapeAppleScriptString('path\\to')).toBe('path\\\\to');
  });

  it('chooseFiles returns file paths from osascript output', async () => {
    mockExecFileSuccess('/tmp/a.mp4\n/tmp/b.mp4\n');

    const result = await chooseFiles('Pick videos');
    expect(result).toEqual({
      canceled: false,
      filePaths: ['/tmp/a.mp4', '/tmp/b.mp4']
    });
    expect(execFile).toHaveBeenCalledWith(
      '/usr/bin/osascript',
      expect.any(Array),
      expect.objectContaining({ maxBuffer: expect.any(Number) }),
      expect.any(Function)
    );
  });

  it('chooseFiles returns canceled when user dismisses panel', async () => {
    mockExecFileCanceled();

    const result = await chooseFiles();
    expect(result).toEqual({ canceled: true, filePaths: [] });
  });

  it('chooseFolder returns selected directory', async () => {
    mockExecFileSuccess('/Users/me/Videos/\n');

    const result = await chooseFolder();
    expect(result).toEqual({
      canceled: false,
      filePaths: ['/Users/me/Videos/']
    });
  });
});
