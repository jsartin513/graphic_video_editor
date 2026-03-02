// Utility functions
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { formatBytes } = require('../src/format-utils');
const {
  getFileName,
  formatDuration,
  getDirectoryPath,
  getDirectoryName,
  debounce,
  formatBitrate,
  formatResolution,
  formatFrameRate,
  formatTimeForFFmpeg
} = require('../src/renderer-utils');
export { formatBytes, getFileName, formatDuration, getDirectoryPath, getDirectoryName, debounce, formatBitrate, formatResolution, formatFrameRate, formatTimeForFFmpeg };

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function escapeAttr(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/`/g, '&#96;').replace(/\r/g, '&#13;').replace(/\n/g, '&#10;');
}

export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

