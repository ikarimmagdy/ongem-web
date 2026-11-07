import { US_MEDIA } from '../../region';
import { postBySlug } from './blog';

/** The paths the blog and videos answer: /blog, /blog/<slug> for a post that exists, /videos (OG-032 R15, R16). */
export const isMediaPath = (path: string) =>
  path === '/blog' ||
  (US_MEDIA && path === '/videos') ||
  (path.startsWith('/blog/') && Boolean(postBySlug(path.slice(6))));
