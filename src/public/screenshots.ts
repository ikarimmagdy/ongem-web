import { t } from '../i18n';
import type { ArtName } from './content';
import approvals from '../assets/public/gallery/web-ongem-approves.jpg';
import assistant from '../assets/public/screen-assistant.jpg';
import cardsPhone from '../assets/public/screen-cards-phone.jpg';
import cards from '../assets/public/screen-cards.jpg';
import companies from '../assets/public/screen-companies.jpg';
import homePhone from '../assets/public/screen-home-phone.jpg';
import home from '../assets/public/screen-home.jpg';
import notificationsPhone from '../assets/public/screen-notifications-phone.jpg';
import notifications from '../assets/public/screen-notifications.jpg';
import paymentsPhone from '../assets/public/screen-payments-phone.jpg';
import schedulesPhone from '../assets/public/screen-payments-schedules-phone.jpg';
import schedules from '../assets/public/screen-payments-schedules.jpg';
import payments from '../assets/public/screen-payments.jpg';
import supportPhone from '../assets/public/screen-support-phone.jpg';
import support from '../assets/public/screen-support.jpg';
import approvals1x from '../assets/public/screen-approvals-1x.jpg';
import assistant1x from '../assets/public/screen-assistant-1x.jpg';
import cards1x from '../assets/public/screen-cards-1x.jpg';
import companies1x from '../assets/public/screen-companies-1x.jpg';
import home1x from '../assets/public/screen-home-1x.jpg';
import notifications1x from '../assets/public/screen-notifications-1x.jpg';
import payments1x from '../assets/public/screen-payments-1x.jpg';
import schedules1x from '../assets/public/screen-payments-schedules-1x.jpg';
import support1x from '../assets/public/screen-support-1x.jpg';

/**
 * Product screens captured from demo mode (sample data only) by `scripts/public-screenshots.mjs` at twice the pixel
 * density (OG-032 R7, R10), recaptured on the OG-035 shell (PS-005): desktop screens are the 940 x 640 content column,
 * so they read at the size the site shows them (PS-017); the approvals screen is the gallery's. Their descriptions are
 * content entries. Width and height are the displayed size in CSS pixels, so the browser reserves the space.
 */
export const SCREENSHOTS = {
  home: {
    src: home,
    width: 940,
    height: 640,
  },
  payments: {
    src: payments,
    width: 940,
    height: 640,
  },
  schedules: {
    src: schedules,
    width: 940,
    height: 640,
  },
  cards: {
    src: cards,
    width: 940,
    height: 640,
  },
  notifications: {
    src: notifications,
    width: 940,
    height: 640,
  },
  support: {
    src: support,
    width: 940,
    height: 640,
  },
  approvals: {
    src: approvals,
    width: 1040,
    height: 760,
  },
  companies: {
    src: companies,
    width: 940,
    height: 640,
  },
  assistant: {
    src: assistant,
    width: 940,
    height: 640,
  },
  homePhone: {
    src: homePhone,
    width: 390,
    height: 844,
  },
  paymentsPhone: {
    src: paymentsPhone,
    width: 390,
    height: 844,
  },
} as const;

export type ScreenName = keyof typeof SCREENSHOTS;

/** What a screenshot shows, for screen readers (`web.shots.<name>.alt`). */
export const shotAlt = (name: ScreenName) =>
  t(`web.shots.${name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}.alt`);

/** The illustration that stands in for a screen where screenshots are left out (the AE build, OG-022 R18). */
export const SCREEN_ART: Record<ScreenName, ArtName> = {
  home: 'accounts',
  payments: 'payments',
  schedules: 'payments',
  cards: 'cards',
  notifications: 'notifications',
  support: 'support',
  approvals: 'approvals',
  companies: 'companies',
  assistant: 'assistant',
  homePhone: 'accounts',
  paymentsPhone: 'payments',
};

/**
 * The same screen as a phone shows it, for narrow pages: a desktop screen shrunk to a phone's width cannot be read
 * (UX-08). Captured by the same script at 390 x 844.
 */
export const PHONE_SCREENS: Partial<Record<ScreenName, string>> = {
  home: homePhone,
  payments: paymentsPhone,
  schedules: schedulesPhone,
  cards: cardsPhone,
  notifications: notificationsPhone,
  support: supportPhone,
};

/** Each desktop screen at its displayed size (1x) besides the capture at twice that (2x), for `srcset` (PS-013). */
const ONE_X: Partial<Record<ScreenName, string>> = {
  home: home1x,
  payments: payments1x,
  schedules: schedules1x,
  cards: cards1x,
  notifications: notifications1x,
  support: support1x,
  approvals: approvals1x,
  companies: companies1x,
  assistant: assistant1x,
};

export function screenSrcSet(name: ScreenName): string | undefined {
  const one = ONE_X[name];
  const s = SCREENSHOTS[name];
  return one ? `${one} ${s.width}w, ${s.src} ${s.width * 2}w` : undefined;
}

/** The widths a framed screen is shown at: the whole column on a phone, about half the page beside text. */
export const SHOT_SIZES = '(max-width: 860px) 100vw, 640px'; // content-check: ignore
/** The hero's desktop screen sits beside the copy, about 420 px wide. */
export const HERO_SIZES = '(max-width: 860px) 100vw, 420px'; // content-check: ignore
export const NARROW = '(max-width: 640px)'; // content-check: ignore
export const WIDE = '(min-width: 641px)'; // content-check: ignore
export { BLANK_IMAGE } from './first-paint';
