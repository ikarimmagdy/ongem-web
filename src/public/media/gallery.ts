import ipadAccounts from '../../assets/public/gallery/app-ipad-accounts.jpg';
import iphoneAccounts from '../../assets/public/gallery/app-iphone-accounts.jpg';
import iphoneReview from '../../assets/public/gallery/app-iphone-payment-review.jpg';
import webAddMoney from '../../assets/public/gallery/web-add-money.jpg';
import webCard from '../../assets/public/gallery/web-card.jpg';
import webOnboarding from '../../assets/public/gallery/web-onboarding.jpg';
import webOngem from '../../assets/public/gallery/web-ongem-approves.jpg';

/**
 * The product gallery (OG-032 R14), fewer and larger since PS-037: four web screens and three app screens: web screens captured from demo mode by `scripts/gallery-screenshots.mjs`, and
 * founder app screens from the ongem-app device run of 29 Oct 2026 (iPhone, iPad and Pixel, sample data only).
 */
export interface GalleryShot {
  src: string;
  /** Its caption and description are `web.gallery.<id>.caption` and `.alt`. */
  id: string;
  width: number;
  height: number;
  device: 'web' | 'phone' | 'tablet';
}

export const WEB_SHOTS: GalleryShot[] = [
  {
    src: webOnboarding,
    id: 'web_onboarding',
    width: 1040,
    height: 760,
    device: 'web',
  },
  {
    src: webAddMoney,
    id: 'web_add_money',
    width: 1040,
    height: 760,
    device: 'web',
  },
  {
    src: webOngem,
    id: 'web_ongem_approves',
    width: 1040,
    height: 760,
    device: 'web',
  },
  {
    src: webCard,
    id: 'web_card',
    width: 1040,
    height: 760,
    device: 'web',
  },
];

export const APP_SHOTS: GalleryShot[] = [
  {
    src: iphoneAccounts,
    id: 'app_iphone_accounts',
    width: 414,
    height: 900,
    device: 'phone',
  },
  {
    src: iphoneReview,
    id: 'app_iphone_payment_review',
    width: 414,
    height: 900,
    device: 'phone',
  },
  {
    src: ipadAccounts,
    id: 'app_ipad_accounts',
    width: 620,
    height: 621,
    device: 'tablet',
  },
];
