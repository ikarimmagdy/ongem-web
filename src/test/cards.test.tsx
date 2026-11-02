import { render, screen, waitFor } from '@testing-library/react';
import { CardWidget } from '../screens/CardWidget';
import userEvent from '@testing-library/user-event';
import { renderApp } from './render';

describe('cards (OG-030 R5)', () => {
  it('freeze_and_unfreeze_with_step_up_AC_R5_1', async () => {
    renderApp('/cards');
    await userEvent.click(await screen.findByTestId('card-crd_demo_dana'));
    await userEvent.click(await screen.findByTestId('card-freeze'));
    await userEvent.type(await screen.findByTestId('reverify-code'), '654321');
    await userEvent.click(screen.getByTestId('reverify-confirm'));
    expect(await screen.findByTestId('card-unfreeze')).toBeInTheDocument();
    expect(screen.getByTestId('card-state')).toHaveTextContent('Frozen');
    await userEvent.click(screen.getByTestId('card-unfreeze'));
    await userEvent.type(await screen.findByTestId('reverify-code'), '654321');
    await userEvent.click(screen.getByTestId('reverify-confirm'));
    expect(await screen.findByTestId('card-freeze')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d{12,}/);
  });
});

describe('card widgets (Synctera widgets, docs/synctera/cards.md s6)', () => {
  it('reveal_opens_after_step_up_and_shows_simulator_sample_CARD_WIDGET_1', async () => {
    renderApp('/cards');
    await userEvent.click(await screen.findByTestId('card-crd_demo_dana'));
    expect(screen.queryByTestId('card-widget-activate')).not.toBeInTheDocument();
    await userEvent.click(await screen.findByTestId('card-widget-reveal'));
    await userEvent.type(await screen.findByTestId('reverify-code'), '654321');
    await userEvent.click(screen.getByTestId('reverify-confirm'));
    const sample = await screen.findByTestId('card-widget-sample');
    expect(sample).toHaveTextContent('Sample data from the simulator');
    expect(sample).toHaveTextContent('4000 0000 0000 5521');
    expect(sample).toHaveAttribute('data-mask');
    await userEvent.click(screen.getByTestId('card-widget-close'));
    expect(screen.queryByTestId('card-widget')).not.toBeInTheDocument();
  });

  it('bank_widget_runs_in_the_banks_frame_with_the_token_never_recorded_CARD_WIDGET_2', async () => {
    const session = {
      cardId: 'crd_1',
      kind: 'REVEAL' as const,
      token: 'tok-secret',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      environment: 'sandbox',
      scriptUrl: 'https://assets-sandbox.synctera.com/widgets/reveal-card/v1.1.1/index.js',
      element: 'reveal-card',
      last4: '1234',
    };
    render(<CardWidget session={session} onClose={() => {}} />);
    const script = document.head.querySelector<HTMLScriptElement>(`script[src="${session.scriptUrl}"]`);
    expect(script).not.toBeNull();
    expect(script!.type).toBe('module');
    script!.dispatchEvent(new Event('load'));
    const host = screen.getByTestId('card-widget-host');
    expect(host).toHaveAttribute('data-block');
    await waitFor(() => expect(host.querySelector('reveal-card')).not.toBeNull());
    const el = host.querySelector('reveal-card')!;
    expect(el.getAttribute('token')).toBe('tok-secret');
    expect(el.getAttribute('env')).toBe('sandbox');
    expect(el.getAttribute('last-four')).toBe('1234');
    el.dispatchEvent(new CustomEvent('failure', { detail: { error: 'x' } }));
    expect(await screen.findByTestId('card-widget-failed')).toBeInTheDocument();
  });

  it('a script from any other host is refused_CARD_WIDGET_3', async () => {
    render(
      <CardWidget
        session={{
          cardId: 'crd_1',
          kind: 'GET_PIN',
          token: 't',
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
          environment: 'sandbox',
          scriptUrl: 'https://evil.example/widgets/reveal-pin/v1.0.0/index.js',
          element: 'reveal-pin',
          last4: '1234',
        }}
        onClose={() => {}}
      />,
    );
    expect(await screen.findByTestId('card-widget-failed')).toBeInTheDocument();
    expect(document.head.querySelector('script[src^="https://evil.example"]')).toBeNull();
  });

  it('the widget closes when its five minutes end_CARD_WIDGET_4', async () => {
    render(
      <CardWidget
        session={{
          cardId: 'crd_1',
          kind: 'REVEAL',
          token: 't',
          expiresAt: new Date(Date.now() - 1).toISOString(),
          environment: 'simulator',
          scriptUrl: null,
          element: null,
          last4: '1234',
        }}
        onClose={() => {}}
      />,
    );
    expect(await screen.findByTestId('card-widget-expired')).toBeInTheDocument();
  });
});
