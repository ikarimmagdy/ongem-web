import { t } from '../../i18n';

/** The words of the blog, videos and gallery (OG-032 R14 to R16) are `web.media.*` content entries (OG-033 R1). */
export const media = (name: string) => t(`web.media.${name}`);
