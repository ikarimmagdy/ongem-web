import { BRAND_ASSETS, BRAND_ASSET_ON_DARK, BRAND_ASSET_SIZES } from '../../assets';
import { useTheme } from '../theme/ThemeProvider';

export function Logo() {
  const { theme } = useTheme();
  const named = theme.logo.wordmark;
  // A dark theme uses the light-ink wordmark when one exists; otherwise the full-colour one sits on its plate.
  const onDark = theme.mode === 'dark' && named ? BRAND_ASSET_ON_DARK[named] : undefined;
  const file = onDark ?? named;
  const src = file ? BRAND_ASSETS[file] : undefined;
  if (src && file) {
    const size = BRAND_ASSET_SIZES[file];
    return (
      <span className={onDark ? 'og-logo og-logo--image og-logo--ink' : 'og-logo og-logo--image'}>
        <img src={src} alt={theme.logo.alt} width={size?.width} height={size?.height} />
      </span>
    );
  }
  return <span className="og-logo og-logo--text">{theme.logo.alt}</span>;
}
