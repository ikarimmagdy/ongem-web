// The page's entry (PS-013): the stylesheets the first screen needs, then the app once the hero has loaded. The app
// itself (`main.tsx`) is a chunk of its own, so the prerendered home paints without waiting on its script.
import './fonts';
import './design-system/styles.css';
import './public/media/media.css';
import './public/public.css';
import './web.css';
import { afterHero } from './boot-gate';

afterHero(document, window.location.pathname, () => void import('./main'));
