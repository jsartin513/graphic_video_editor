// Testable functions extracted from main.js
const { formatBytes } = require('./format-utils');

function formatFileSize(bytes) {
  return formatBytes(bytes, { singularByte: true });
}

module.exports = {
  formatFileSize
};
