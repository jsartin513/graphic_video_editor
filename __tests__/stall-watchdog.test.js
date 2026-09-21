const { createStallWatchdog } = require('../src/stall-watchdog');

describe('createStallWatchdog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires if there is no progress before the timeout', () => {
    const onStall = jest.fn();
    createStallWatchdog(1000, onStall);

    jest.advanceTimersByTime(999);
    expect(onStall).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it('does not fire while progress keeps arriving', () => {
    const onStall = jest.fn();
    const watchdog = createStallWatchdog(1000, onStall);

    jest.advanceTimersByTime(900);
    watchdog.ping();
    jest.advanceTimersByTime(900);
    watchdog.ping();
    jest.advanceTimersByTime(900);

    expect(onStall).not.toHaveBeenCalled();
  });

  it('fires after progress stops for the full timeout', () => {
    const onStall = jest.fn();
    const watchdog = createStallWatchdog(1000, onStall);

    jest.advanceTimersByTime(500);
    watchdog.ping();
    jest.advanceTimersByTime(1000);

    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it('clear prevents a pending stall from firing', () => {
    const onStall = jest.fn();
    const watchdog = createStallWatchdog(1000, onStall);

    watchdog.clear();
    jest.advanceTimersByTime(2000);

    expect(onStall).not.toHaveBeenCalled();
  });

  it('does not fire twice', () => {
    const onStall = jest.fn();
    const watchdog = createStallWatchdog(1000, onStall);

    jest.advanceTimersByTime(1000);
    watchdog.ping();
    jest.advanceTimersByTime(1000);

    expect(onStall).toHaveBeenCalledTimes(1);
  });
});
