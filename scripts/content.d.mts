export interface ChannelSnapshot {
  channel: string;
  locale: string;
  version: string;
  entries: Record<string, string>;
  meta: Record<string, Record<string, string>>;
  fallback: string[];
}
export interface Snapshot {
  region: 'us' | 'ae';
  source: string;
  locales: Record<'en' | 'ar', Record<string, ChannelSnapshot>>;
}
export const PUBLIC_CHANNELS: string[];
export const LOCALES: string[];
export const DEFAULT_API: Record<'us' | 'ae', string>;
export function regionOf(env?: Record<string, string | undefined>): 'us' | 'ae';
export function readSeed(root: string, region: string): Record<string, unknown[]>;
export function seedSnapshot(root: string, region: 'us' | 'ae'): Snapshot;
export function fetchSnapshot(apiBase: string, region: string, fetchImpl?: typeof fetch): Promise<Snapshot>;
