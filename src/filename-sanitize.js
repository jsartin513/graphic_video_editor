const WINDOWS_RESERVED = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
]);

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
  const stem = result.includes('.') ? result.slice(0, result.lastIndexOf('.')) : result;
  const reservedStem = stem.toLowerCase();
  if (WINDOWS_RESERVED.has(reservedStem)) {
    result = `_${result}`;
  }
  return result;
}

module.exports = {
  sanitizeFilenameForOutput
};
