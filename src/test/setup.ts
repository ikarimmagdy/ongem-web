import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock data is relative to the clock; pin it to the moment the demo story is written for.
vi.useFakeTimers({ now: new Date('2026-10-20T14:42:00Z'), toFake: ['Date'] });

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
