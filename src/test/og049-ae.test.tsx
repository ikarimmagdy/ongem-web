import { screen } from '@testing-library/react';
import { DemoOnGemApi } from '../api/demo';
import { renderApp } from './render';

vi.hoisted(() => {
  vi.stubEnv('VITE_REGION', 'AE');
});

describe('OG-049 in the AE build', () => {
  it('each account names a licensed UAE bank, never a US bank, and the total is in AED', async () => {
    renderApp('/', { api: new DemoOnGemApi({ scenario: 'currencies_total' }) });
    expect(await screen.findByTestId('home-institution-acc_demo_ops')).toHaveTextContent(
      'A licensed UAE bank',
    );
    expect(await screen.findByTestId('home-indicative')).toHaveTextContent('Total in AED');
    expect(document.body.textContent).not.toMatch(/Piermont|FDIC|US\$/);
  });
});
