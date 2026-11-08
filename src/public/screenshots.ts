import { t } from '../i18n';
import type { ArtName } from './content';
import cardsPhone from '../assets/public/screen-cards-phone.jpg';
import cards from '../assets/public/screen-cards.jpg';
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

/**
 * Product screens captured from demo mode (sample data only) by `scripts/public-screenshots.mjs` at twice the pixel
 * density (OG-032 R7, R10). Their descriptions are content entries. Width and height are the displayed size in CSS pixels, so the browser reserves the space.
 */
export const SCREENSHOTS = {
  home: {
    src: home,
    width: 1440,
    height: 900,
  },
  payments: {
    src: payments,
    width: 1080,
    height: 720,
  },
  schedules: {
    src: schedules,
    width: 1080,
    height: 720,
  },
  cards: {
    src: cards,
    width: 1080,
    height: 720,
  },
  notifications: {
    src: notifications,
    width: 1080,
    height: 720,
  },
  support: {
    src: support,
    width: 1080,
    height: 720,
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
