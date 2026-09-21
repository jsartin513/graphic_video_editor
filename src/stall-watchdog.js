/**
 * Watchdog that fires only when an operation stops making progress.
 * Progress (ping) resets the timer so long-running work is allowed.
 */

function createStallWatchdog(timeoutMs, onStall) {
  if (typeof timeoutMs !== 'number' || timeoutMs <= 0) {
    throw new Error('timeoutMs must be a positive number');
  }
  if (typeof onStall !== 'function') {
    throw new Error('onStall must be a function');
  }

  let timer = null;
  let fired = false;

  function arm() {
    if (fired) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fired = true;
      timer = null;
      onStall();
    }, timeoutMs);
  }

  arm();

  return {
    ping() {
      arm();
    },
    clear() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
    hasFired() {
      return fired;
    }
  };
}

module.exports = {
  createStallWatchdog
};
