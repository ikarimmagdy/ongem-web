/**
 * The one switch for screen and action recording (G-156, Karim 2026-11-03: not needed, so off). It lives here, apart
 * from the recorder, so sign-in can read it without loading rrweb.
 */
export const RECORDING_ENABLED = false;

/** What OnGem tells founders while recording is on (OG-030 R8). */
export const PRIVACY_LINE_RECORDING =
  'We record the screens you use and what you tap, with account numbers, balances and identity details hidden, to improve ' +
  'OnGem and help when you ask for support. Recordings stay with OnGem.';

/** What is true while recording is off: no screen recording, and the audit trail the bank requires (UX-05). */
export const PRIVACY_LINE_OFF =
  'OnGem does not record your screen. We keep a log of the changes you make, such as payments and approvals, because ' +
  'the bank requires it, and we use it only to run your account and to help when you ask for support.';

/** The privacy line shown on sign-in and in Settings; it always matches the recording switch. */
export const PRIVACY_LINE = RECORDING_ENABLED ? PRIVACY_LINE_RECORDING : PRIVACY_LINE_OFF;
