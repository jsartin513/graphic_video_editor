// Quality option constants and validation (extracted from main.js)

const QUALITY_COPY = 'copy';
const QUALITY_HIGH = 'high';
const QUALITY_MEDIUM = 'medium';
const QUALITY_LOW = 'low';

// Video quality settings for encoding
const QUALITY_SETTINGS = {
  [QUALITY_HIGH]: { crf: '18', preset: 'slow' },
  [QUALITY_MEDIUM]: { crf: '23', preset: 'medium' },
  [QUALITY_LOW]: { crf: '28', preset: 'fast' }
};

// Valid quality options (including 'copy' which doesn't use QUALITY_SETTINGS)
const VALID_QUALITY_OPTIONS = [QUALITY_COPY, QUALITY_HIGH, QUALITY_MEDIUM, QUALITY_LOW];

/**
 * Validates that the quality option is one of the allowed values
 * @param {string} qualityOption - The quality option to validate
 * @throws {Error} If the quality option is not valid
 */
function validateQualityOption(qualityOption) {
  if (!VALID_QUALITY_OPTIONS.includes(qualityOption)) {
    throw new Error(`Invalid quality option: ${qualityOption}. Must be one of: ${VALID_QUALITY_OPTIONS.join(', ')}`);
  }
}

module.exports = {
  QUALITY_COPY,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  QUALITY_LOW,
  QUALITY_SETTINGS,
  VALID_QUALITY_OPTIONS,
  validateQualityOption
};
