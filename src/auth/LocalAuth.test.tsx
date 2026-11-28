import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocalAuth, isLoopbackHost } from './LocalAuth';
import { useAuthSession } from './session';

const NADIA = {
  id: 'nadia',
  name: 'Nadia Karam',
  email: 'nadia.karam@ops.local.test',
  role: 'Operations maker',
};

function Probe() {
  const auth = useAuthSession();
  if (!auth.loaded) return <p>loading</p>;
  if (!auth.signedIn) return auth.SignIn ? <auth.SignIn /> : <p>no sign-in</p>;
  return (
    <div>
      <p data-testid="who">{auth.user?.name}</p>
      <button onClick={() => void auth.getToken().then((t) => (document.title = t ?? 'none'))}>token</button>
    </div>
  );
}

function stubIssuer() {
  let persona: typeof NADIA | null = null;
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (url.startsWith('/local-identity/personas')) return json({ personas: [NADIA] });
      if (url.startsWith('/local-identity/session') && init?.method === 'POST') {
        persona = JSON.parse(String(init.body)).persona ? NADIA : null;
        return json({ persona });
      }
      if (url.startsWith('/local-identity/session')) return json({ persona });
      if (url === '/local-identity/token')
        return json({ token: 'tok_nadia', expiresAt: Date.now() / 1000 + 600 });
      return new Response('{}', { status: 404 });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('OG-100 local sign-in', () => {
  it('AC-R3_2 a persona chosen in the local sign-in is signed in and its token goes to the API', async () => {
    const calls = stubIssuer();
    render(
      <LocalAuth>
        <Probe />
      </LocalAuth>,
    );
    fireEvent.click(await screen.findByTestId('persona-nadia'));
    expect(await screen.findByTestId('who')).toHaveTextContent('Nadia Karam');
    await act(async () => fireEvent.click(screen.getByText('token')));
    await waitFor(() => expect(document.title).toBe('tok_nadia'));
    expect(calls).toContain('POST /local-identity/token');
  });

  it('AC-R3_3 refuses a host that is not loopback', () => {
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('console.ongem.com')).toBe(false);
    const location = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...location, hostname: 'console.ongem.com' },
      configurable: true,
    });
    try {
      render(
        <LocalAuth>
          <Probe />
        </LocalAuth>,
      );
      expect(screen.getByText(/signs in only on this machine/)).toBeInTheDocument();
      expect(screen.queryByText('loading')).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'location', { value: location, configurable: true });
    }
  });
});
