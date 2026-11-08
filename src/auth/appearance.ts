// content-check: data (CSS values for Clerk's form, no words)
import type { Theme } from '../design-system';

/** Clerk's appearance from the active theme's tokens, so the sign-in form follows the theme switcher. */
export function clerkAppearance(theme: Theme) {
  const { color, typography, radius, shadow } = theme;
  const display = { fontFamily: typography.display.family, fontWeight: typography.display.weight };
  return {
    variables: {
      colorPrimary: color.action.primaryBg,
      colorPrimaryForeground: color.action.primaryText,
      colorBackground: color.surface.card,
      colorInput: color.surface.card,
      colorInputForeground: color.text.primary,
      colorForeground: color.text.primary,
      colorMuted: color.surface.sunken,
      colorMutedForeground: color.text.secondary,
      colorNeutral: color.text.primary,
      colorBorder: color.border.strong,
      colorRing: color.border.focus,
      colorShadow: color.brand.deep,
      colorModalBackdrop: color.brand.deep,
      colorDanger: color.status.failure,
      colorSuccess: color.status.success,
      colorWarning: color.status.pending,
      fontFamily: typography.body.family,
      fontFamilyButtons: typography.body.family,
      fontSize: `${typography.scale.sm}px`,
      borderRadius: `${radius.md}px`,
    },
    elements: {
      rootBox: 'og-signin__clerk',
      cardBox: {
        boxShadow: shadow.card,
        border: `1px solid ${color.border.default}`,
        borderRadius: `${radius.lg}px`,
      },
      card: { boxShadow: 'none', border: 'none' },
      headerTitle: { ...display, fontSize: `${typography.scale.xl}px`, color: color.text.primary },
      headerSubtitle: { color: color.text.secondary },
      formButtonPrimary: {
        backgroundColor: color.action.primaryBg,
        color: color.action.primaryText,
        backgroundImage: 'none',
        boxShadow: 'none',
        fontWeight: typography.bodyStrong.weight,
        textTransform: 'none',
        '&:hover': { backgroundColor: color.action.primaryHoverBg },
      },
      socialButtonsBlockButton: {
        backgroundColor: color.action.secondaryBg,
        color: color.action.secondaryText,
        border: `1px solid ${color.action.secondaryBorder}`,
        boxShadow: 'none',
      },
      footerActionLink: { color: color.text.link, fontWeight: typography.bodyStrong.weight },
      formFieldInput: { boxShadow: 'none', border: `1px solid ${color.border.strong}` },
      navbar: { background: color.surface.sunken },
      profileSectionTitleText: display,
    },
  };
}
