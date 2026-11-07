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
 * density (OG-032 R7, R10). Width and height are the displayed size in CSS pixels, so the browser reserves the space.
 */
export const SCREENSHOTS = {
  home: {
    src: home,
    alt: 'The OnGem home screen on the web: the company, its identity check at the bank and the balance across accounts, on sample data',
    width: 1440,
    height: 900,
  },
  payments: {
    src: payments,
    alt: 'The OnGem payments list: ACH and internal payments marked sent, settled or returned, on sample data',
    width: 1080,
    height: 720,
  },
  schedules: {
    src: schedules,
    alt: 'Scheduled payments with their next payment date and controls to pause, resume or cancel, on sample data',
    width: 1080,
    height: 720,
  },
  cards: {
    src: cards,
    alt: 'Virtual cards with their state and the controls to freeze, unfreeze and show details, on sample data',
    width: 1080,
    height: 720,
  },
  notifications: {
    src: notifications,
    alt: 'The notifications inbox with payment, approval and card notices, on sample data',
    width: 1080,
    height: 720,
  },
  support: {
    src: support,
    alt: 'Support tickets with their status and replies, on sample data',
    width: 1080,
    height: 720,
  },
  homePhone: {
    src: homePhone,
    alt: 'The OnGem app home screen on a phone, on sample data',
    width: 390,
    height: 844,
  },
  paymentsPhone: {
    src: paymentsPhone,
    alt: 'The OnGem app payments screen on a phone, on sample data',
    width: 390,
    height: 844,
  },
} as const;

export type ScreenName = keyof typeof SCREENSHOTS;

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
