import { screen, waitFor } from '@testing-library/react';
import { IS_AE } from '../region';
import { renderApp } from './render';

// The AE build (VITE_REGION=AE) for this file only, set before region.ts loads.
vi.hoisted(() => {
  vi.stubEnv('VITE_REGION', 'AE');
});

/** US bank, BaaS provider and partner names, US rails and US dollars (OG-022 R18). */
const FORBIDDEN =
  /Piermont|Synctera|GenZone|FDIC|\bSSN\b|Social Security|\bITIN\b|\bEIN\b|\bACH\b|Fedwire|\bwires?\b|US\$|\$\d|routing/i;

const text = () => document.body.textContent ?? '';

describe('OG-035 in the AE build', () => {
  it('AC_R10_3 Home, Payments tabs, Documents and More show AED and no US name', async () => {
    expect(IS_AE).toBe(true);
    const home = renderApp('/');
    expect(await screen.findByTestId('home-total')).toHaveTextContent('AED');
    await screen.findByTestId('needs-list');
    await waitFor(() =>
      expect(screen.getByTestId('need-approval-pay_demo_approval')).toHaveTextContent('AED'),
    );
    expect(text()).not.toMatch(FORBIDDEN);
    home.unmount();
    for (const [route, testId] of [
      ['/payments', 'payments-list'],
      ['/payments/approvals', 'approvals-list'],
      ['/documents', 'documents-statements'],
      ['/more', 'more-list'],
      ['/team', 'team-you'],
    ] as const) {
      const r = renderApp(route);
      await screen.findByTestId(testId);
      expect(text(), route).not.toMatch(FORBIDDEN);
      r.unmount();
    }
  });
});
