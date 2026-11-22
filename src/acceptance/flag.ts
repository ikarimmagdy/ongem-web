import { IS_AE } from '../region';

/**
 * OG-039 payment acceptance (ADR-0055, proposed): on only when the build sets VITE_ACCEPTANCE_ENABLED=true, never in a
 * UAE build (residency, ADR-0050), and only when the core says it is on for this environment.
 */
export const ACCEPTANCE_ENABLED: boolean = import.meta.env.VITE_ACCEPTANCE_ENABLED === 'true' && !IS_AE;

/** OG-058: the buyer's pay link page, `/pay/<token>`, answered without sign-in. */
export const PAY_LINK_PATH = /^\/pay\/[^/]+\/?$/;
