import { t } from '../i18n/store';

/**
 * The one switch for screen and action recording (G-156, Karim 2026-11-03: not needed, so off). It lives here, apart
 * from the recorder, so sign-in can read it without loading rrweb.
 */
export const RECORDING_ENABLED = false;

/** What OnGem tells founders while recording is on (OG-030 R8). */
export const privacyLineRecording = () => t('app.privacy.recording');

/** What is true while recording is off: no screen recording, and the audit trail the bank requires (UX-05). */
export const privacyLineOff = () => t('app.privacy.off');

/** The privacy line shown on sign-in and in Settings; it always matches the recording switch. */
export const privacyLine = () => (RECORDING_ENABLED ? privacyLineRecording() : privacyLineOff());
