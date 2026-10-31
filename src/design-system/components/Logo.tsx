import { BRAND_ASSETS, BRAND_ASSET_SIZES } from '../../assets';
import { useTheme } from '../theme/ThemeProvider';

export function Logo() {
  const { theme } = useTheme();
  const src = theme.logo.wordmark ? BRAND_ASSETS[theme.logo.wordmark] : undefined;
  if (src) {
    const size = theme.logo.wordmark ? BRAND_ASSET_SIZES[theme.logo.wordmark] : undefined;
    return (
      <span className="og-logo og-logo--image">
        <img src={src} alt={theme.logo.alt} width={size?.width} height={size?.height} />
      </span>
    );
  }
  return <span className="og-logo og-logo--text">{theme.logo.alt}</span>;
}
