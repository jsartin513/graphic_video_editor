const { getRootFolderFromWebkitFiles } = require('../main/web-file-picker');

describe('web-file-picker helpers', () => {
  it('getRootFolderFromWebkitFiles returns parent dir for flat selection', () => {
    const root = getRootFolderFromWebkitFiles([
      { path: '/Users/me/Videos/a.mp4', webkitRelativePath: 'a.mp4' }
    ]);
    expect(root).toBe('/Users/me/Videos');
  });

  it('getRootFolderFromWebkitFiles returns root for nested selection', () => {
    const root = getRootFolderFromWebkitFiles([
      { path: '/Users/me/Videos/sub/a.mp4', webkitRelativePath: 'sub/a.mp4' }
    ]);
    expect(root).toBe('/Users/me/Videos');
  });

  it('getRootFolderFromWebkitFiles handles root folder name in webkitRelativePath', () => {
    const root = getRootFolderFromWebkitFiles([
      { path: '/Users/me/Videos/sub/a.mp4', webkitRelativePath: 'Videos/sub/a.mp4' }
    ]);
    expect(root).toBe('/Users/me/Videos');
  });
});
