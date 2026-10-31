import { BRAND_ASSETS } from '../../assets';
import { useTheme } from '../theme/ThemeProvider';

export function Logo() {
  const { theme } = useTheme();
  const src = theme.logo.wordmark ? BRAND_ASSETS[theme.logo.wordmark] : undefined;
  if (src) {
    return (
      <span className="og-logo og-logo--image">
        <img src={src} alt={theme.logo.alt} />
      </span>
    );
  }
  return <span className="og-logo og-logo--text">{theme.logo.alt}</span>;
}
