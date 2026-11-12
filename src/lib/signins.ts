import type { SignInView } from '../api/types';
import { getLocale, t } from '../i18n/store';
import { formatDate } from './format';

/** FA-029: the country's name in the reader's language, else its code. */
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames([getLocale() === 'ar' ? 'ar' : 'en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** FA-029: what the person signed in on: the app device's name, the browser and system, or the kind of app. */
export function signInDevice(s: SignInView): string {
  if (s.deviceName) return s.deviceName;
  if (s.kind === 'ios') return t('app.settings.security.device_ios');
  if (s.kind === 'android') return t('app.settings.security.device_android');
  if (s.kind === 'unbound') return t('app.settings.security.device_unbound');
  if (s.browser && s.os) return t('app.settings.security.device_web', { browser: s.browser, os: s.os });
  return s.browser ?? t('app.settings.security.device_browser');
}

/** FA-029: where, approximately, as the edge named it; "Place not known" otherwise. */
export function signInPlace(s: SignInView): string {
  const city = s.place?.city;
  const country = s.place?.country ? countryName(s.place.country) : null;
  if (city && country) return t('app.settings.security.place', { city, country });
  return city ?? country ?? t('app.settings.security.place_unknown');
}

/** FA-029: when and where, on one line. */
export function signInLine(s: SignInView): string {
  return t('app.settings.security.sign_in_line', {
    date: formatDate(s.at, { time: true }),
    place: signInPlace(s),
  });
}

/** FA-055: the sign-in before this session, in words. */
export function lastSignInText(last: SignInView | null | undefined): string {
  return last
    ? t('app.settings.security.last_sign_in', { date: formatDate(last.at, { time: true }) })
    : t('app.settings.security.first_sign_in');
}
