import { useSyncExternalStore } from 'react';
import { t } from '../i18n/store';

/** Whether the web records, and the digit-run length the mask hides (OG-073), as ongem-core serves them. */
export interface RecordingSettings {
  enabled: boolean;
  maskDigitRun: number;
}

/** Until the server answers, and whenever it cannot: no recording, three-digit mask. */
export const RECORDING_OFF: RecordingSettings = { enabled: false, maskDigitRun: 3 };

let current: RecordingSettings = RECORDING_OFF;
const listeners = new Set<() => void>();

/**
 * The one switch for screen and action recording (OG-073, Karim 2026-11-26: on at launch, from configuration). It lives
 * here, apart from the recorder, so sign-in can read it without loading rrweb.
 */
export const recordingSettings = (): RecordingSettings => current;

export function setRecordingSettings(next: RecordingSettings) {
  current = next;
  listeners.forEach((l) => l());
}

/** Only a well formed answer turns recording on; a digit run outside 2 to 5 falls back to 3. */
export function parseRecordingSettings(body: unknown): RecordingSettings {
  const b = (body ?? {}) as { enabled?: unknown; maskDigitRun?: unknown };
  const run = b.maskDigitRun;
  return {
    enabled: b.enabled === true,
    maskDigitRun: typeof run === 'number' && Number.isInteger(run) && run >= 2 && run <= 5 ? run : 3,
  };
}

const API_BASE = import.meta.env.VITE_API_BASE_URL?.trim() || '/api-dev';

/** Reads GET /v1/public/recording once at start; any failure leaves recording off. */
export async function loadRecordingSettings(
  base: string = API_BASE,
  fetcher: typeof fetch = fetch,
): Promise<RecordingSettings> {
  let next = RECORDING_OFF;
  try {
    const res = await fetcher(`${base.replace(/\/$/, '')}/v1/public/recording`, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) next = parseRecordingSettings(await res.json());
  } catch {
    // Unreachable server: recording stays off.
  }
  setRecordingSettings(next);
  return next;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The recording settings for a component, re-rendered when the server's answer arrives. */
export const useRecordingSettings = () =>
  useSyncExternalStore(subscribe, recordingSettings, recordingSettings);

/** What OnGem tells founders while recording is on (OG-030 R8). */
export const privacyLineRecording = () => t('app.privacy.recording');

/** What is true while recording is off: no screen recording, and the audit trail the bank requires (UX-05). */
export const privacyLineOff = () => t('app.privacy.off');

/** The privacy line shown on sign-in and in Settings; it always matches the recording switch. */
export const privacyLine = (s: RecordingSettings = current) =>
  s.enabled ? privacyLineRecording() : privacyLineOff();
