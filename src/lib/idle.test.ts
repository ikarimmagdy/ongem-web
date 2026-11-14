import { idleState, startIdleWatch, type IdleState } from './idle';

const MIN = 60_000;
const KEY = 'test.idle.last';

beforeEach(() => {
  vi.useFakeTimers({
    now: new Date('2026-11-14T10:00:00Z'),
    toFake: ['Date', 'setInterval', 'clearInterval'],
  });
});
afterEach(() => {
  vi.useFakeTimers({ now: new Date('2026-10-20T14:42:00Z'), toFake: ['Date'] });
});

function watch(timeoutMs = 15 * MIN, warnMs = MIN) {
  const seen: IdleState[] = [];
  const w = startIdleWatch({ timeoutMs, warnMs, storageKey: KEY, onChange: (s) => seen.push(s) });
  return { w, seen, last: () => seen[seen.length - 1]! };
}

describe('OG-042 idle timer', () => {
  it('phases: active, warning in the last minute, expired at the limit', () => {
    expect(idleState(0, 13 * MIN, 15 * MIN, MIN).phase).toBe('active');
    expect(idleState(0, 14 * MIN, 15 * MIN, MIN)).toEqual({ phase: 'warning', remainingMs: MIN });
    expect(idleState(0, 15 * MIN, 15 * MIN, MIN)).toEqual({ phase: 'expired', remainingMs: 0 });
    expect(idleState(0, 99 * MIN, 15 * MIN, MIN).remainingMs).toBe(0);
  });

  it('warns 60 seconds before and expires at the timeout', () => {
    const { w, last } = watch();
    expect(last().phase).toBe('active');
    vi.advanceTimersByTime(14 * MIN - 1000);
    expect(last().phase).toBe('active');
    vi.advanceTimersByTime(1000);
    expect(last()).toEqual({ phase: 'warning', remainingMs: MIN });
    vi.advanceTimersByTime(MIN);
    expect(last().phase).toBe('expired');
    w.stop();
  });

  it('expires once, not on every tick', () => {
    const { w, seen } = watch();
    vi.advanceTimersByTime(20 * MIN);
    expect(seen.filter((s) => s.phase === 'expired')).toHaveLength(1);
    w.stop();
  });

  it.each(['pointerdown', 'pointermove', 'keydown', 'focus'])('%s resets the timer', (event) => {
    const { w, last } = watch();
    vi.advanceTimersByTime(14 * MIN + 10_000);
    expect(last().phase).toBe('warning');
    window.dispatchEvent(new Event(event));
    expect(last().phase).toBe('active');
    vi.advanceTimersByTime(14 * MIN - 1000);
    expect(last().phase).toBe('active');
    w.stop();
  });

  it('focus the page moves itself (a dialog opening) is not activity', () => {
    const { w, last } = watch();
    vi.advanceTimersByTime(14 * MIN + 10_000);
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    expect(last().phase).toBe('warning');
    button.remove();
    w.stop();
  });

  it('activity in another tab (the shared time in storage) keeps this tab signed in', () => {
    const { w, last } = watch();
    vi.advanceTimersByTime(14 * MIN + 30_000);
    expect(last().phase).toBe('warning');
    localStorage.setItem(KEY, String(Date.now()));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    expect(last().phase).toBe('active');
    w.stop();
  });

  it('a laptop that slept past the limit signs out on the next tick', () => {
    const { w, last } = watch();
    vi.setSystemTime(Date.now() + 60 * MIN);
    vi.advanceTimersByTime(1000);
    expect(last().phase).toBe('expired');
    w.stop();
  });

  it('records the activity time for other tabs and stops listening when stopped', () => {
    const { w, last } = watch();
    expect(Number(localStorage.getItem(KEY))).toBe(Date.now());
    w.stop();
    vi.advanceTimersByTime(14 * MIN);
    window.dispatchEvent(new Event('keydown'));
    expect(last().phase).toBe('active');
    expect(Number(localStorage.getItem(KEY))).toBe(Date.now() - 14 * MIN);
  });
});
