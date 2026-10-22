/**
 * Camera filename parsing for action cameras and drones.
 * Used by video-grouping to recognize clips beyond GoPro naming.
 */

/** DJI splits large recordings (~4GB); continuation clips follow in numeric order. */
const DJI_SPLIT_SIZE_BYTES = 4090000000;

/**
 * @typedef {'gopro'|'dji'|'insta360'|'sony'|'generic'} CameraVendor
 */

/**
 * @typedef {Object} ParsedCameraFile
 * @property {CameraVendor} vendor
 * @property {string|null} sessionId - Stable session key within a directory (null if assigned later, e.g. DJI chains)
 * @property {string} sortKey - Lexicographic sort order within a session
 * @property {boolean} [needsDjiChain]
 * @property {number} [djiIndex]
 * @property {number} [sonyIndex]
 * @property {string} [patternPrefix] - Prefix for derivePatternFromFilename ({sessionId} appended)
 */

/**
 * Parse a video basename into camera metadata, or null if unsupported / non-video sidecar.
 * @param {string} filename - Basename only (e.g. "GX010001.MP4")
 * @returns {ParsedCameraFile|null}
 */
function parseCameraFilename(filename) {
  if (!filename || typeof filename !== 'string') return null;

  // Insta360 low-res proxies — not merged as main video
  if (/^LRV_/i.test(filename)) return null;

  const goproSession = extractGoProSessionId(filename);
  if (goproSession) {
    const base = filename.replace(/\.MP4$/i, '');
    const prefix = base.slice(0, -goproSession.length);
    return {
      vendor: 'gopro',
      sessionId: goproSession,
      sortKey: filename,
      patternPrefix: `${prefix}{sessionId}`
    };
  }

  const instaMatch = filename.match(
    /^(?:PRO_)?VID_(\d{8})_(\d{6})_(\d{2})_(\d{3})\.(insv|mp4)$/i
  );
  if (instaMatch) {
    const lens = instaMatch[3];
    // Secondary / proxy lens tracks — same capture, not sequential segments
    if (lens === '10' || lens === '11' || lens === '01') return null;
    const date = instaMatch[1];
    const time = instaMatch[2];
    const segment = instaMatch[4];
    const vidPrefix = filename.startsWith('PRO_') ? 'PRO_VID_' : 'VID_';
    return {
      vendor: 'insta360',
      sessionId: `${date}_${time}_${lens}`,
      sortKey: segment,
      patternPrefix: `${vidPrefix}${date}_${time}_${lens}_{sessionId}`
    };
  }

  const djiSimple = filename.match(/^DJI_(\d+)\.(mp4|mov)$/i);
  if (djiSimple) {
    const index = parseInt(djiSimple[1], 10);
    return {
      vendor: 'dji',
      sessionId: null,
      sortKey: String(index).padStart(4, '0'),
      needsDjiChain: true,
      djiIndex: index,
      patternPrefix: 'DJI_{sessionId}'
    };
  }

  const djiLong = filename.match(/^DJI_(\d{14,17})_(\d+)_D\.(mp4|mov)$/i);
  if (djiLong) {
    return {
      vendor: 'dji',
      sessionId: djiLong[1],
      sortKey: djiLong[2].padStart(4, '0'),
      patternPrefix: `DJI_${djiLong[1]}_{sessionId}`
    };
  }

  const sonyMatch = filename.match(/^C(\d{4})\.(mp4|mov)$/i);
  if (sonyMatch) {
    const index = parseInt(sonyMatch[1], 10);
    return {
      vendor: 'sony',
      sessionId: null,
      sortKey: String(index).padStart(4, '0'),
      sonyIndex: index,
      patternPrefix: 'C{sessionId}'
    };
  }

  // DJI / drone flat naming (no Insta360 lens segment)
  const vidGeneric = filename.match(/^VID_(\d{8})_(\d{6})(?:_(\d+))?\.(mp4|mov)$/i);
  if (vidGeneric) {
    const suffix = vidGeneric[3] || '000';
    return {
      vendor: 'generic',
      sessionId: `${vidGeneric[1]}_${vidGeneric[2]}`,
      sortKey: suffix.padStart(3, '0'),
      patternPrefix: `VID_${vidGeneric[1]}_${vidGeneric[2]}_{sessionId}`
    };
  }

  return null;
}

/**
 * GoPro session ID extraction (legacy helper).
 * @param {string} filename
 * @returns {string|null}
 */
function extractGoProSessionId(filename) {
  const gxMatch = filename.match(/GX[A-Z0-9]{2}(\d{4})\.MP4$/i);
  if (gxMatch) return gxMatch[1];

  const gpMatch = filename.match(/GP[A-Z0-9]{2}(\d{4})\.MP4$/i);
  if (gpMatch) return gpMatch[1];

  const goprMatch = filename.match(/GOPR(\d{4})\.MP4$/i);
  if (goprMatch) return goprMatch[1];

  return null;
}

/**
 * Human-readable label for SD card / UI.
 * @param {CameraVendor|string|undefined} vendor
 * @returns {string}
 */
function cameraVendorLabel(vendor) {
  switch (vendor) {
    case 'gopro': return 'GoPro';
    case 'dji': return 'DJI';
    case 'insta360': return 'Insta360';
    case 'sony': return 'Sony';
    case 'generic': return 'Camera';
    default: return 'Camera';
  }
}

module.exports = {
  DJI_SPLIT_SIZE_BYTES,
  parseCameraFilename,
  extractGoProSessionId,
  cameraVendorLabel
};
