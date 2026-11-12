import { createContext, useContext } from 'react';

/**
 * True while `src/prerender.tsx` renders the static first screen (PS-013): images below the hero are left out of that
 * HTML, so on a slow phone the hero screen has the bandwidth to itself; the app's first render puts them back, eager
 * (OG-034 R1), once the hero has loaded (`src/boot-gate.ts`).
 */
export const FirstPaint = createContext(false);
export const useFirstPaint = () => useContext(FirstPaint);

/** A transparent pixel for the frame a width hides, so the browser requests no image for it. */
export const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
