const { parseCameraFilename, extractGoProSessionId, cameraVendorLabel } = require('../src/camera-filenames');

describe('parseCameraFilename', () => {
  test('parses GoPro GX files', () => {
    const parsed = parseCameraFilename('GX010001.MP4');
    expect(parsed.vendor).toBe('gopro');
    expect(parsed.sessionId).toBe('0001');
  });

  test('parses DJI numeric clips', () => {
    const parsed = parseCameraFilename('DJI_0026.MP4');
    expect(parsed.vendor).toBe('dji');
    expect(parsed.needsDjiChain).toBe(true);
    expect(parsed.djiIndex).toBe(26);
  });

  test('parses DJI long-form Osmo filenames', () => {
    const parsed = parseCameraFilename('DJI_20231201154533_0160_D.MP4');
    expect(parsed.vendor).toBe('dji');
    expect(parsed.sessionId).toBe('20231201154533');
    expect(parsed.sortKey).toBe('0160');
  });

  test('parses Insta360 main lens segments', () => {
    const parsed = parseCameraFilename('VID_20220110_121609_00_657.insv');
    expect(parsed.vendor).toBe('insta360');
    expect(parsed.sessionId).toBe('20220110_121609_00');
    expect(parsed.sortKey).toBe('657');
  });

  test('skips Insta360 secondary lens and LRV', () => {
    expect(parseCameraFilename('VID_20220110_121609_10_657.insv')).toBeNull();
    expect(parseCameraFilename('LRV_20220110_121609_11_657.lrv')).toBeNull();
  });

  test('parses Sony chapter files', () => {
    const parsed = parseCameraFilename('C0001.MP4');
    expect(parsed.vendor).toBe('sony');
    expect(parsed.sonyIndex).toBe(1);
  });

  test('parses generic VID drone clips', () => {
    const parsed = parseCameraFilename('VID_20240101_120000_001.MP4');
    expect(parsed.vendor).toBe('generic');
    expect(parsed.sessionId).toBe('20240101_120000');
  });
});

describe('extractGoProSessionId', () => {
  test('remains backward compatible', () => {
    expect(extractGoProSessionId('GX010001.MP4')).toBe('0001');
    expect(extractGoProSessionId('DJI_0026.MP4')).toBeNull();
  });
});

describe('cameraVendorLabel', () => {
  test('returns readable labels', () => {
    expect(cameraVendorLabel('dji')).toBe('DJI');
    expect(cameraVendorLabel('insta360')).toBe('Insta360');
  });
});
