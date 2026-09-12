const fs = require('fs').promises;
const path = require('path');
const { VIDEO_EXTENSIONS } = require('./video-scanner');

const SKIP_NAMES = new Set(['.DS_Store', 'Thumbs.db', '.localized']);

function isVideoFile(name) {
  return VIDEO_EXTENSIONS.includes(path.extname(name).toLowerCase());
}

function parentDirectory(dirPath) {
  const resolved = path.resolve(dirPath);
  const parent = path.dirname(resolved);
  return parent === resolved ? null : parent;
}

function getBrowserRoots(paths = {}) {
  const roots = [
    { id: 'home', label: 'Home', path: paths.home },
    { id: 'desktop', label: 'Desktop', path: paths.desktop },
    { id: 'documents', label: 'Documents', path: paths.documents },
    { id: 'movies', label: 'Movies', path: paths.videos },
    { id: 'downloads', label: 'Downloads', path: paths.downloads }
  ];
  return roots.filter((root) => typeof root.path === 'string' && root.path.length > 0);
}

async function listVolumes(volumesPath = '/Volumes') {
  try {
    const names = await fs.readdir(volumesPath);
    return names
      .filter((name) => name && !name.startsWith('.'))
      .map((name) => ({ name, path: path.join(volumesPath, name) }));
  } catch (error) {
    return [];
  }
}

async function listDirectory(dirPath) {
  if (!dirPath || typeof dirPath !== 'string') {
    throw new Error('Directory path is required');
  }

  const resolved = path.resolve(dirPath);
  const stats = await fs.stat(resolved);
  if (!stats.isDirectory()) {
    throw new Error('Not a directory');
  }

  const dirents = await fs.readdir(resolved, { withFileTypes: true });
  const entries = [];

  for (const dirent of dirents) {
    if (SKIP_NAMES.has(dirent.name) || dirent.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(resolved, dirent.name);
    let isDirectory = dirent.isDirectory();
    if (dirent.isSymbolicLink()) {
      try {
        const linkStats = await fs.stat(fullPath);
        isDirectory = linkStats.isDirectory();
      } catch (error) {
        continue;
      }
    }

    const isVideo = !isDirectory && isVideoFile(dirent.name);
    if (!isDirectory && !isVideo) {
      continue;
    }

    entries.push({
      name: dirent.name,
      path: fullPath,
      isDirectory,
      isVideo
    });
  }

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? 1 : -1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return {
    path: resolved,
    parent: parentDirectory(resolved),
    entries
  };
}

module.exports = {
  SKIP_NAMES,
  isVideoFile,
  parentDirectory,
  getBrowserRoots,
  listVolumes,
  listDirectory
};
