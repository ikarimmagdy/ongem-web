import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Routed } from '../App';
import type { OnGemApi } from '../api/client';
import { AuthProvider, NO_AUTH, type AuthSession } from '../auth';
import { ThemeProvider, ToastProvider } from '../design-system';
import { SessionProvider, type Mode } from '../session';

/** The whole founder web at [route], in demo mode by default, with no sign-in key (as this build has). */
export function renderApp(route = '/', opts: { api?: OnGemApi; mode?: Mode; auth?: AuthSession } = {}) {
  return render(
    <AuthProvider value={opts.auth ?? NO_AUTH}>
      <MemoryRouter initialEntries={[route]}>
        <ThemeProvider>
          <ToastProvider timeoutMs={0}>
            <SessionProvider initialMode={opts.mode ?? 'demo'} api={opts.api}>
              <Routed />
            </SessionProvider>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>
    </AuthProvider>,
  );
}

/**
 * A phone-width layout for the shell (OG-035): `useWide` reads matchMedia, which jsdom lacks, so without this the
 * desktop layout renders (side bar switcher, command search, no floating assistant button). Returns the undo.
 */
export function asPhone(): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((q: string) => ({
    matches: !q.includes('min-width'),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

/** OG-050: the open list of a design-system Select (a combobox button and its list), opened first when closed. */
async function openList(trigger: HTMLElement): Promise<HTMLElement> {
  const { default: userEvent } = await import('@testing-library/user-event');
  if (trigger.getAttribute('aria-expanded') !== 'true') await userEvent.click(trigger);
  const list = document.getElementById(trigger.getAttribute('aria-controls') ?? '');
  if (!list) throw new Error(`select ${trigger.getAttribute('data-testid') ?? trigger.id} did not open`);
  return list;
}

/** Picks an option in a Select by its value, or by its label when [option] is a pattern, as a person does. */
export async function chooseOption(trigger: HTMLElement, option: string | RegExp): Promise<void> {
  const { default: userEvent } = await import('@testing-library/user-event');
  const options = Array.from((await openList(trigger)).querySelectorAll<HTMLElement>('[role="option"]'));
  const hit = options.find((o) =>
    typeof option === 'string' ? o.dataset.value === option : option.test(o.textContent ?? ''),
  );
  if (!hit)
    throw new Error(`no option ${String(option)} in ${trigger.getAttribute('data-testid') ?? trigger.id}`);
  await userEvent.click(hit);
}

/** The labels a Select offers, read by opening its list and closing it again. */
export async function optionLabels(trigger: HTMLElement): Promise<string[]> {
  const { default: userEvent } = await import('@testing-library/user-event');
  const list = await openList(trigger);
  const labels = Array.from(list.querySelectorAll('[role="option"]')).map((o) => o.textContent ?? '');
  await userEvent.click(trigger);
  return labels;
}

/** Picks [day] (YYYY-MM-DD) in a design-system DatePicker, moving month by month to it as a person does. */
export async function chooseDate(trigger: HTMLElement, day: string): Promise<void> {
  const { default: userEvent } = await import('@testing-library/user-event');
  if (trigger.getAttribute('aria-expanded') !== 'true') await userEvent.click(trigger);
  const panel = () => document.getElementById(trigger.getAttribute('aria-controls') ?? '')!;
  for (let i = 0; i < 120; i++) {
    const hit = panel().querySelector<HTMLElement>(`[data-day="${day}"]`);
    if (hit) return userEvent.click(hit);
    const shown = panel().querySelector<HTMLElement>('[data-day][tabindex="0"]')!.dataset.day!;
    await userEvent.click(
      panel().querySelector<HTMLElement>(
        day < shown ? '[data-testid="date-previous-month"]' : '[data-testid="date-next-month"]',
      )!,
    );
  }
  throw new Error(`day ${day} not reached`);
}
