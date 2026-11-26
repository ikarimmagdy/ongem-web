import { BRAND_ASSETS, BRAND_ASSET_ON_DARK, BRAND_ASSET_SIZES } from '../../assets';
import type { Theme } from '../theme/types';
import { useTheme, type BrandFace } from '../theme/ThemeProvider';

export interface LogoImage {
  /** Image URL, or undefined when the name is shown as text. */
  src?: string;
  alt: string;
  /** Light ink for a dark surface. */
  ink: boolean;
  width?: number;
  height?: number;
}

/**
 * The wordmark to show (OG-082): the brand's own wordmark URL when it has one, else the theme's logo file (light ink on
 * a dark surface when one exists), else the brand's name as text. [surface] `dark` always asks for the light ink.
 */
export function logoImage(
  theme: Theme,
  brand: BrandFace | null,
  surface: 'theme' | 'dark' | 'light',
): LogoImage {
  const alt = brand?.name ?? theme.logo.alt;
  if (brand?.wordmark) return { src: brand.wordmark, alt, ink: false };
  const named = theme.logo.wordmark;
  const dark = surface === 'dark' || (surface === 'theme' && theme.mode === 'dark');
  const onDark = dark && named ? BRAND_ASSET_ON_DARK[named] : undefined;
  const file = onDark ?? (surface === 'dark' ? undefined : named);
  const src = file ? BRAND_ASSETS[file] : undefined;
  if (!src || !file) return { alt, ink: false };
  const size = BRAND_ASSET_SIZES[file];
  return { src, alt, ink: Boolean(onDark), width: size?.width, height: size?.height };
}

export function Logo() {
  const { theme, brand } = useTheme();
  const logo = logoImage(theme, brand, 'theme');
  if (logo.src)
    return (
      <span className={logo.ink ? 'og-logo og-logo--image og-logo--ink' : 'og-logo og-logo--image'}>
        <img src={logo.src} alt={logo.alt} width={logo.width} height={logo.height} />
      </span>
    );
  return <span className="og-logo og-logo--text">{logo.alt}</span>;
}
