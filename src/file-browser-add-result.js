/**
 * How many videos were actually added to Selected Videos (not just resolved paths).
 * @param {{ added?: unknown[], files?: unknown[] } | null | undefined} result
 * @returns {number}
 */
function countAddedVideosFromBrowserResult(result) {
  if (!result || !Array.isArray(result.added)) {
    return 0;
  }
  return result.added.length;
}

module.exports = { countAddedVideosFromBrowserResult };
