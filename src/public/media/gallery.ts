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
  alt: string;
  caption: string;
  width: number;
  height: number;
  device: 'web' | 'phone' | 'tablet';
}

export const WEB_SHOTS: GalleryShot[] = [
  {
    src: webOnboarding,
    caption: 'Your application, step by step',
    alt: 'The account application: owner identity done, then confirm details, disclosures and submit to the bank, on sample data',
    width: 1040,
    height: 760,
    device: 'web',
  },
  {
    src: webAddMoney,
    caption: 'Add money from another bank',
    alt: 'Add money: a verified account at another bank, the OnGem account to fund and the amount, on sample data',
    width: 1040,
    height: 760,
    device: 'web',
  },
  {
    src: webOngem,
    caption: 'OnGem approves for a one-person company',
    alt: 'A top-up waiting for OnGem to approve it, because no one else in the company can approve payments, on sample data',
    width: 1040,
    height: 760,
    device: 'web',
  },
  {
    src: webCard,
    caption: 'A virtual card and its controls',
    alt: 'A virtual card with show card details, show PIN, set PIN, freeze and dispute a charge, on sample data',
    width: 1040,
    height: 760,
    device: 'web',
  },
  {
    src: webDispute,
    caption: 'Dispute a charge from the card',
    alt: 'A new support request about a charge on the card ending 5521, on sample data',
    width: 1040,
    height: 760,
    device: 'web',
  },
  {
    src: webChoices,
    caption: 'Choose how each notice reaches you',
    alt: 'Notification settings: email and text for each kind of notice, with the important ones always on, on sample data',
    width: 1040,
    height: 760,
    device: 'web',
  },
];

export const APP_SHOTS: GalleryShot[] = [
  {
    src: iphoneAccounts,
    caption: 'Accounts on iPhone',
    alt: 'The OnGem app on iPhone: accounts with their bank balances, on sample data',
    width: 414,
    height: 900,
    device: 'phone',
  },
  {
    src: iphoneReview,
    caption: 'Review before you send',
    alt: 'The OnGem app on iPhone: a US$1,250.00 ACH payment to Acme Supplies LLC under review, on sample data',
    width: 414,
    height: 900,
    device: 'phone',
  },
  {
    src: iphoneSent,
    caption: 'Sent, and followed to settled',
    alt: 'The OnGem app on iPhone: a payment sent to the bank, on sample data',
    width: 414,
    height: 900,
    device: 'phone',
  },
  {
    src: iphoneDark,
    caption: 'Dark theme',
    alt: 'The OnGem app on iPhone in the dark theme: an account and its transactions, on sample data',
    width: 414,
    height: 900,
    device: 'phone',
  },
  {
    src: androidReturned,
    caption: 'A returned payment on Android',
    alt: 'The OnGem app on a Pixel phone: a payment the bank returned, on sample data',
    width: 403,
    height: 900,
    device: 'phone',
  },
  {
    src: ipadAccounts,
    caption: 'Two panes on iPad',
    alt: 'The OnGem app on iPad: accounts and the selected account side by side, on sample data',
    width: 620,
    height: 621,
    device: 'tablet',
  },
];
