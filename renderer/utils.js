// Utility functions

export function getFileName(filePath) {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1];
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds) || (typeof seconds === 'string' && seconds.trim() === '')) return 'Unknown';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function getDirectoryPath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) return '.';
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));

  if (lastSep < 0) {
    return '.';
  }

  if (lastSep === 0) {
    // POSIX root, e.g. "/video.mp4"
    return '/';
  }

  // Handle Windows drive root, e.g. "C:\\video.mp4" or "C:/video.mp4"
  if (lastSep === 2 && filePath[1] === ':') {
    // Preserve the trailing separator so we return "C:\\" or "C:/"
    return filePath.substring(0, lastSep + 1);
  }

  return filePath.substring(0, lastSep);
}

export function getDirectoryName(filePath) {
  // Handle non-string or empty paths with a meaningful default
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return 'root';
  }

  // Remove trailing slashes before processing
  const cleanPath = filePath.replace(/[/\\]+$/, '');
  
  // Split on both forward and back slashes and remove empty components
  const parts = cleanPath.split(/[/\\]/).filter(part => part.length > 0);

  // If there is no clear parent directory, return a sensible default
  if (parts.length < 2) {
    return 'root';
  }

  // Get parent directory name
  return parts[parts.length - 2];
}

export function getDirectoryPath(filePath) {
  // Get the directory path from a file path
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return '';
  }
  
  const parts = filePath.split(/[/\\]/);
  return parts.slice(0, -1).join('/');
}

export function formatTimeForFFmpeg(seconds) {
  // Format time in seconds to HH:MM:SS format for ffmpeg
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

