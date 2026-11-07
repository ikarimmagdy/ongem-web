import recorded from './videos.json';

/**
 * Founder walkthrough videos (OG-032 R16), recorded from demo mode by `scripts/record-videos.mjs`: WebM with a WebVTT
 * caption track and a poster frame each, served from public/videos/. videos.json holds what the recording measured.
 */
export interface Video {
  id: string;
  title: string;
  summary: string;
  seconds: number;
  bytes: number;
  width: number;
  height: number;
}

export const VIDEOS: Video[] = recorded;

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const videoSrc = (id: string) => `${base}videos/${id}.webm`;
export const videoTrack = (id: string) => `${base}videos/${id}.vtt`;
export const videoPoster = (id: string) => `${base}videos/${id}.jpg`;
export const videoById = (id: string) => VIDEOS.find((v) => v.id === id);

/** 0:25, the length a viewer reads. */
export function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The videos featured on the home and product pages. */
export const FEATURED = ['send-a-payment', 'ongem-approves-one-person-company', 'cards-freeze-and-details'];
