import { has, t } from '../i18n/store';

/**
 * Founder-facing words for API states (UI review 2026-11-07, OG-030 R-UX-3): internal names such as COLLECTING never
 * reach a founder. One short label for chips and lists, one sentence where a state needs explaining. The words are
 * content entries `app.state.application.<state>.label` and `.sentence`, and `app.state.payment.<state>` (OG-033 R1).
 */
const fallback = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
const key = (s: string) => s.toLowerCase();

export const applicationLabel = (state: string) => {
  const k = `app.state.application.${key(state)}.label`;
  return has(k) ? t(k) : fallback(state);
};
export const applicationSentence = (state: string) => {
  const k = `app.state.application.${key(state)}.sentence`;
  return has(k) ? t(k) : t('app.state.application.other', { state: fallback(state).toLowerCase() });
};
export const paymentLabel = (state: string) => {
  const k = `app.state.payment.${key(state)}`;
  return has(k) ? t(k) : fallback(state);
};
