const {
  validateQualityOption,
  QUALITY_COPY,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  QUALITY_LOW,
  VALID_QUALITY_OPTIONS
} = require('../src/quality-utils');

describe('validateQualityOption', () => {
  test('accepts valid quality options', () => {
    expect(() => validateQualityOption(QUALITY_COPY)).not.toThrow();
    expect(() => validateQualityOption(QUALITY_HIGH)).not.toThrow();
    expect(() => validateQualityOption(QUALITY_MEDIUM)).not.toThrow();
    expect(() => validateQualityOption(QUALITY_LOW)).not.toThrow();
    expect(() => validateQualityOption('copy')).not.toThrow();
    expect(() => validateQualityOption('high')).not.toThrow();
  });

  test('throws for invalid quality options', () => {
    expect(() => validateQualityOption('invalid')).toThrow(
      'Invalid quality option: invalid. Must be one of: copy, high, medium, low'
    );
    expect(() => validateQualityOption('')).toThrow(
      /Invalid quality option/
    );
    expect(() => validateQualityOption(null)).toThrow(
      /Invalid quality option/
    );
    expect(() => validateQualityOption(undefined)).toThrow(
      /Invalid quality option/
    );
  });

  test('error message lists all valid options', () => {
    try {
      validateQualityOption('foo');
      fail('Should have thrown');
    } catch (e) {
      expect(e.message).toContain('copy');
      expect(e.message).toContain('high');
      expect(e.message).toContain('medium');
      expect(e.message).toContain('low');
    }
  });
});

describe('constants', () => {
  test('VALID_QUALITY_OPTIONS contains all four options', () => {
    expect(VALID_QUALITY_OPTIONS).toEqual(['copy', 'high', 'medium', 'low']);
  });
});
