const { buildGapOverlayText, escapeDrawtext } = require('../src/gap-merge');

describe('gap-merge', () => {
  test('buildGapOverlayText includes duration when known', () => {
    const text = buildGapOverlayText({ gapKnown: true, gapSeconds: 125 });
    expect(text).toContain('missing');
    expect(text).toContain('2 min');
  });

  test('buildGapOverlayText unknown time', () => {
    expect(buildGapOverlayText({ gapKnown: false, gapSeconds: null })).toContain('unknown');
  });

  test('escapeDrawtext escapes colons', () => {
    expect(escapeDrawtext('a:b')).toContain('\\:');
  });
});
