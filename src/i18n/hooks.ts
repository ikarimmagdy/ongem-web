import { useEffect, useSyncExternalStore } from 'react';
import { contentRevision, getLocale, refreshOnce, subscribe } from './store';
import type { Channel } from './types';

/** Re-renders the caller when the texts or the language change; returns the language. */
export function useContent() {
  useSyncExternalStore(subscribe, contentRevision, contentRevision);
  return getLocale();
}

/** Asks the API for the channels this page reads (once per page load and language). */
export function useChannels(...list: Channel[]) {
  const locale = useContent();
  const id = list.join(',');
  useEffect(() => refreshOnce(id.split(',') as Channel[]), [id, locale]);
}
