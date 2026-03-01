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
  if (!seconds || isNaN(seconds)) return 'Unknown';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function getDirectoryName(filePath) {
  // Handle non-string or empty paths with a meaningful default
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return 'root';
  }

  // Split on both forward and back slashes and remove empty components
  const parts = filePath.split(/[/\\]/).filter(part => part.length > 0);

  // If there is no clear parent directory, return a sensible default
  if (parts.length < 2) {
    return 'root';
  }

  // Get parent directory name
  return parts[parts.length - 2];
}

export function formatBitrate(bitrate) {
  if (!bitrate || isNaN(bitrate)) return 'Unknown';
  const kbps = bitrate / 1000;
  const mbps = kbps / 1000;
  
  if (mbps >= 1) {
    return `${mbps.toFixed(2)} Mbps`;
  }
  return `${kbps.toFixed(0)} Kbps`;
}

export function formatResolution(width, height) {
  if (!width || !height) return 'Unknown';
  return `${width}x${height}`;
}

export function formatFrameRate(fps) {
  if (!fps || isNaN(fps)) return 'Unknown';
  return `${fps} fps`;
}

