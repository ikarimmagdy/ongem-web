import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// findBy and waitFor wait on a condition; the default 1 s ceiling timed out when the whole suite ran in parallel.
configure({ asyncUtilTimeout: 5000 });

// Mock data is relative to the clock; pin it to the moment the demo story is written for.
vi.useFakeTimers({ now: new Date('2026-10-20T14:42:00Z'), toFake: ['Date'] });

// jsdom has no layout, so its scrollTo only reports "not implemented"; the public site calls it on every page change.
window.scrollTo = (() => undefined) as typeof window.scrollTo;

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* storage unavailable */
  }
  document.documentElement.removeAttribute('style');
});
