import home from '../assets/public/screenshot-home.png';
import payments from '../assets/public/screenshot-payments.png';

/** Product screenshots captured from demo mode (sample data only) with headless Chromium at 1440 x 900 (OG-032 R7). */
export const SCREENSHOTS = {
  home: {
    src: home,
    alt: 'The OnGem home screen with the company balance, recent payments and verification status, on sample data',
    width: 1440,
    height: 900,
  },
  payments: {
    src: payments,
    alt: 'The OnGem payments screen with sent, settled and returned ACH and internal payments, on sample data',
    width: 1440,
    height: 900,
  },
} as const;
