import androidReturned from '../../assets/public/gallery/app-android-payment-returned.jpg';
import ipadAccounts from '../../assets/public/gallery/app-ipad-accounts.jpg';
import iphoneAccounts from '../../assets/public/gallery/app-iphone-accounts.jpg';
import iphoneDark from '../../assets/public/gallery/app-iphone-dark-account.jpg';
import iphoneReview from '../../assets/public/gallery/app-iphone-payment-review.jpg';
import iphoneSent from '../../assets/public/gallery/app-iphone-payment-sent.jpg';
import webAddMoney from '../../assets/public/gallery/web-add-money.jpg';
import webCard from '../../assets/public/gallery/web-card.jpg';
import webDispute from '../../assets/public/gallery/web-dispute.jpg';
import webChoices from '../../assets/public/gallery/web-notification-choices.jpg';
import webOnboarding from '../../assets/public/gallery/web-onboarding.jpg';
import webOngem from '../../assets/public/gallery/web-ongem-approves.jpg';

/**
 * The product gallery (OG-032 R14): web screens captured from demo mode by `scripts/gallery-screenshots.mjs`, and
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
  {
    src: webDispute,
    id: 'web_dispute',
    width: 1040,
    height: 760,
    device: 'web',
  },
  {
    src: webChoices,
    id: 'web_notification_choices',
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
    src: iphoneSent,
    id: 'app_iphone_payment_sent',
    width: 414,
    height: 900,
    device: 'phone',
  },
  {
    src: iphoneDark,
    id: 'app_iphone_dark_account',
    width: 414,
    height: 900,
    device: 'phone',
  },
  {
    src: androidReturned,
    id: 'app_android_payment_returned',
    width: 403,
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
