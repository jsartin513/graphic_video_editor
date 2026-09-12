const WINDOWS_RESERVED = new Set([
  'con', 'conin$', 'conout$', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
]);

/**
 * Windows treats the segment before the first dot as the device name (e.g. CON.notes.v1).
 * @param {string} basename
 * @returns {string}
 */
function windowsDeviceStem(basename) {
  if (!basename || typeof basename !== 'string') return '';
  const segment = basename.split(/[/\\]/).pop() || basename;
  const dotIndex = segment.indexOf('.');
  return (dotIndex === -1 ? segment : segment.slice(0, dotIndex)).toLowerCase();
}

function isWindowsReservedBasename(basename) {
  return WINDOWS_RESERVED.has(windowsDeviceStem(basename));
}

/**
 * Remove characters invalid in filenames on common desktop OSes; preserve spaces.
 * Strips control chars, trailing dots/spaces, and prefixes Windows reserved device names.
 * @param {string} name
 * @returns {string}
 */
function sanitizeFilenameForOutput(name) {
  if (!name || typeof name !== 'string') return '';
  let result = name.replace(/[\u0000-\u001f\u007f]/g, '_');
  result = result.replace(/[/\\:*?"<>|]/g, '_');
  result = result.replace(/[.\s]+$/g, '').trim();
  if (!result) return 'output';
  if (isWindowsReservedBasename(result)) {
    result = `_${result}`;
  }
  return result;
}

module.exports = {
  sanitizeFilenameForOutput,
  isWindowsReservedBasename,
  windowsDeviceStem
};
