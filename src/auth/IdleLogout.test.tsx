import { act, fireEvent, render, screen } from '@testing-library/react';
import { SessionProvider, type Mode } from '../session';
import { IdleLogout } from './IdleLogout';
import { AuthProvider, NO_AUTH, type AuthSession } from './session';

const MIN = 60_000;

beforeEach(() => {
  vi.useFakeTimers({
    now: new Date('2026-11-14T10:00:00Z'),
    toFake: ['Date', 'setInterval', 'clearInterval'],
  });
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => undefined));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useFakeTimers({ now: new Date('2026-10-20T14:42:00Z'), toFake: ['Date'] });
});

function renderIdle(auth: AuthSession, mode: Mode) {
  return render(
    <AuthProvider value={auth}>
      <SessionProvider initialMode={mode}>
        <IdleLogout />
      </SessionProvider>
    </AuthProvider>,
  );
}

const live = (): AuthSession => ({
  ...NO_AUTH,
  available: true,
  signedIn: true,
  signOut: vi.fn(() => Promise.resolve()),
});

describe('OG-042 idle logout', () => {
  it('warns at 29 minutes, Stay signed in keeps the session, and 30 idle minutes sign out with Clerk', () => {
    const auth = live();
    renderIdle(auth, 'none');
    act(() => void vi.advanceTimersByTime(29 * MIN));
    expect(screen.getByTestId('idle-warning')).toHaveTextContent('signed out in 60 seconds');
    fireEvent.click(screen.getByTestId('idle-stay'));
    expect(screen.queryByTestId('idle-warning')).not.toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(29 * MIN));
    expect(auth.signOut).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(MIN));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('the demo never signs out', () => {
    const auth = { ...NO_AUTH, signOut: vi.fn(() => Promise.resolve()) };
    renderIdle(auth, 'demo');
    act(() => void vi.advanceTimersByTime(60 * MIN));
    expect(screen.queryByTestId('idle-warning')).not.toBeInTheDocument();
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
