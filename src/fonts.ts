// OG-040: one family, self-hosted from the bundle (no font CDN). Inter 400, 500 and 600 for every Latin text (OG-050:
// the Latin and Latin Extended subsets only; other scripts fall back to the system face); IBM Plex Sans Arabic in the
// same three weights, Arabic subset only, fetched when a page has Arabic text (unicode-range).
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
