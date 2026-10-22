const path = require('path');
const {
  chainDjiEntries,
  endTimestampSec,
  DJI_SPLIT_SIZE_BYTES
} = require('../src/dji-grouping');

const DIR = '/videos/dji';

function entry(index) {
  const id = String(index).padStart(4, '0');
  return { filePath: path.join(DIR, `DJI_${id}.MP4`), djiIndex: index };
}

function sizesFor(indices, largeIndices = []) {
  const sizes = {};
  for (const i of indices) {
    const filePath = entry(i).filePath;
    sizes[filePath] = largeIndices.includes(i)
      ? DJI_SPLIT_SIZE_BYTES + 1
      : 500_000_000;
  }
  return sizes;
}

describe('chainDjiEntries', () => {
  test('chains segments when creation time is contiguous after a 4GB head', () => {
    const entries = [entry(24), entry(25), entry(26)];
    const t0 = '2024-01-15T10:00:00.000000Z';
    const timings = {
      [entry(24).filePath]: { creation: t0, duration: 3600 },
      [entry(25).filePath]: {
        creation: '2024-01-15T11:00:00.000000Z',
        duration: 3600
      },
      [entry(26).filePath]: {
        creation: '2024-01-15T12:00:00.000000Z',
        duration: 900
      }
    };
    // Align segment 25/26 start times to end of previous (ceil start + duration)
    timings[entry(25).filePath].creation = new Date(
      endTimestampSec(t0, 3600) * 1000
    ).toISOString().replace('.000Z', '.000000Z');
    timings[entry(26).filePath].creation = new Date(
      endTimestampSec(timings[entry(25).filePath].creation, 3600) * 1000
    ).toISOString().replace('.000Z', '.000000Z');

    const groups = chainDjiEntries(
      DIR,
      entries,
      timings,
      sizesFor([24, 25, 26], [24, 25])
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].sessionId).toBe('0024-0026');
    expect(groups[0].files).toHaveLength(3);
  });

  test('does not chain consecutive filenames when timestamps do not line up', () => {
    const entries = [entry(24), entry(25)];
    const timings = {
      [entry(24).filePath]: { creation: '2024-01-15T10:00:00.000000Z', duration: 60 },
      [entry(25).filePath]: { creation: '2024-01-15T14:00:00.000000Z', duration: 60 }
    };

    const groups = chainDjiEntries(
      DIR,
      entries,
      timings,
      sizesFor([24, 25], [24])
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].files).toHaveLength(1);
    expect(groups[1].files).toHaveLength(1);
  });

  test('keeps small clips as separate sessions without a 4GB split head', () => {
    const entries = [entry(24), entry(25)];
    const timings = {
      [entry(24).filePath]: { creation: '2024-01-15T10:00:00.000000Z', duration: 60 },
      [entry(25).filePath]: { creation: '2024-01-15T10:01:01.000000Z', duration: 60 }
    };

    const groups = chainDjiEntries(
      DIR,
      entries,
      timings,
      sizesFor([24, 25], [])
    );

    expect(groups).toHaveLength(2);
  });

  test('does not start a second chain from a large continuation segment', () => {
    const entries = [entry(24), entry(25), entry(26)];
    const t0 = '2024-01-15T10:00:00.000000Z';
    const timings = {
      [entry(24).filePath]: { creation: t0, duration: 100 },
      [entry(25).filePath]: { creation: '', duration: 100 },
      [entry(26).filePath]: { creation: '2024-01-15T20:00:00.000000Z', duration: 100 }
    };
    timings[entry(25).filePath].creation = new Date(
      endTimestampSec(t0, 100) * 1000
    ).toISOString().replace('.000Z', '.000000Z');

    const groups = chainDjiEntries(
      DIR,
      entries,
      timings,
      sizesFor([24, 25, 26], [24, 25])
    );

    expect(groups.filter((g) => g.files.length > 1)).toHaveLength(1);
    expect(groups.find((g) => g.sessionId === '0026')).toBeDefined();
  });
});
