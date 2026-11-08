export type Locale = 'en' | 'ar';
export const LOCALES: Locale[] = ['en', 'ar'];

/** The public channels the web reads (OG-033 contract); `notice` and `policy` are never public. */
export type Channel = 'web_public' | 'web_app' | 'blog' | 'faq' | 'legal';

/** One channel in one locale, as GET /v1/public/content/{channel}?locale= answers it. */
export interface ChannelContent {
  channel: string;
  locale: string;
  version: string;
  entries: Record<string, string>;
  meta: Record<string, Record<string, string>>;
  fallback: string[];
  /** The ETag the API sent, sent back as If-None-Match. */
  etag?: string;
}

export type RegionContent = Partial<Record<Channel, ChannelContent>>;
