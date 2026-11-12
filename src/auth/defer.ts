import { isAppPath } from '../public/content';

/**
 * PS-013: Clerk loads before the first render only where it is needed: an app path (sign-in, the signed-in screens) or a
 * browser that holds a Clerk session (`__client_uat`, set by Clerk's script, is a non-zero time while signed in). A
 * signed-out visitor on the public site gets Clerk when they open an app path.
 */
export function clerkFirst(path: string, cookie: string): boolean {
  return isAppPath(path) || /(?:^|;\s*)__client_uat(?:_[^=;]*)?=[1-9]\d*/.test(cookie);
}
