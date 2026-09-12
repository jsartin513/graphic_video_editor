/**
 * Helpers for turning renderer FileList / drag events into filesystem paths.
 * With contextIsolation, File.path is often empty in page JS — preload should
 * call these helpers, where Electron still attaches paths.
 */

function getFilePath(file, webUtilsGetPath) {
  if (!file) return '';
  if (typeof file.path === 'string' && file.path) return file.path;
  if (typeof webUtilsGetPath === 'function') {
    try {
      const fromWebUtils = webUtilsGetPath(file);
      if (typeof fromWebUtils === 'string' && fromWebUtils) return fromWebUtils;
    } catch (error) {
      // Ignore — caller will try URI-list fallback
    }
  }
  return '';
}

function getPathsFromFileList(fileList, webUtilsGetPath) {
  return Array.from(fileList || []).map((file) => getFilePath(file, webUtilsGetPath)).filter(Boolean);
}

function fileUrlToPath(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return '';
  const trimmed = fileUrl.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  if (!/^file:/i.test(trimmed)) return '';
  try {
    const url = new URL(trimmed);
    let pathname = decodeURIComponent(url.pathname);
    if (/^\/[A-Za-z]:\//.test(pathname)) {
      pathname = pathname.slice(1);
    }
    return pathname;
  } catch (error) {
    return '';
  }
}

function pathsFromUriList(uriList) {
  if (!uriList || typeof uriList !== 'string') return [];
  return uriList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map(fileUrlToPath)
    .filter(Boolean);
}

function isOsFileDrop(dataTransfer) {
  if (!dataTransfer) return false;
  if (dataTransfer.files && dataTransfer.files.length > 0) return true;
  const types = Array.from(dataTransfer.types || []);
  return types.includes('Files') || types.includes('public.file-url');
}

function pathsFromDataTransfer(dataTransfer, webUtilsGetPath) {
  if (!dataTransfer) return [];
  const fromFiles = getPathsFromFileList(dataTransfer.files, webUtilsGetPath);
  if (fromFiles.length) return fromFiles;
  const uriList = (typeof dataTransfer.getData === 'function'
    ? (dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain') || '')
    : '');
  return pathsFromUriList(uriList);
}

function getRootFolderFromFiles(files, webUtilsGetPath) {
  const list = Array.from(files || []);
  if (!list.length) return null;
  const first = list[0];
  const fullPath = getFilePath(first, webUtilsGetPath);
  if (!fullPath) return null;
  const rel = first.webkitRelativePath || first.name || '';
  if (!rel.includes('/') && !rel.includes('\\')) {
    return fullPath.replace(/[/\\][^/\\]+$/, '');
  }
  return fullPath.slice(0, fullPath.length - rel.length).replace(/[/\\]$/, '');
}

module.exports = {
  getFilePath,
  getPathsFromFileList,
  getRootFolderFromFiles,
  fileUrlToPath,
  pathsFromUriList,
  isOsFileDrop,
  pathsFromDataTransfer
};
