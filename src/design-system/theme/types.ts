export const THEME_SCHEMA = 'ongem-theme/v1';

export interface FontRole {
  family: string;
  weight: number;
  transform?: string;
  tracking?: string;
  numeric?: string;
}

export interface Theme {
  $schema: typeof THEME_SCHEMA;
  id: string;
  name: string;
  version: number;
  source?: string;
  mode?: 'light' | 'dark';
  color: {
    brand: Record<BrandKey, string>;
    surface: Record<SurfaceKey, string>;
    text: Record<TextKey, string>;
    border: Record<BorderKey, string>;
    action: Record<ActionKey, string>;
    status: Record<StatusKey, string>;
    category: Record<CategoryKey, string>;
  };
  gradient: { brand: string[] };
  typography: {
    display: FontRole;
    label: FontRole;
    body: FontRole;
    bodyStrong: FontRole;
    money: FontRole;
    scale: Record<ScaleKey, number>;
  };
  space: Record<SpaceKey, number>;
  radius: Record<RadiusKey, number>;
  shadow: Record<ShadowKey, string>;
  /** Asset names from src/assets; `favicon` falls back to a letter mark when absent or null. */
  logo: { wordmark: string | null; favicon?: string | null; alt: string };
  rules?: string[];
}

export interface ThemeBundle {
  default: string;
  themes: Theme[];
}

export const BRAND_KEYS = [
  'primary',
  'primaryHover',
  'secondary',
  'signature',
  'signatureSoft',
  'accent',
  'info',
  'gold',
  'deep',
] as const;
export const SURFACE_KEYS = [
  'canvas',
  'card',
  'raised',
  'sunken',
  'inverse',
  'tintBlue',
  'tintViolet',
  'tintMint',
] as const;
export const TEXT_KEYS = ['primary', 'secondary', 'muted', 'inverse', 'link', 'money'] as const;
export const BORDER_KEYS = ['default', 'subtle', 'strong', 'focus'] as const;
export const ACTION_KEYS = [
  'primaryBg',
  'primaryText',
  'primaryHoverBg',
  'secondaryBg',
  'secondaryText',
  'secondaryBorder',
  'dangerBg',
  'dangerText',
] as const;
export const STATUS_KEYS = [
  'success',
  'successBg',
  'pending',
  'pendingBg',
  'failure',
  'failureBg',
  'info',
  'infoBg',
  'neutral',
  'neutralBg',
] as const;
export const CATEGORY_KEYS = [
  'banking',
  'bankingBg',
  'global',
  'globalBg',
  'cards',
  'cardsBg',
  'compliance',
  'complianceBg',
  'treasury',
  'treasuryBg',
] as const;
export const FONT_ROLES = ['display', 'label', 'body', 'bodyStrong', 'money'] as const;
export const SCALE_KEYS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const;
export const SPACE_KEYS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const;
export const RADIUS_KEYS = ['sm', 'md', 'lg', 'xl', 'pill'] as const;
export const SHADOW_KEYS = ['card', 'raised'] as const;

export type BrandKey = (typeof BRAND_KEYS)[number];
export type SurfaceKey = (typeof SURFACE_KEYS)[number];
export type TextKey = (typeof TEXT_KEYS)[number];
export type BorderKey = (typeof BORDER_KEYS)[number];
export type ActionKey = (typeof ACTION_KEYS)[number];
export type StatusKey = (typeof STATUS_KEYS)[number];
export type CategoryKey = (typeof CATEGORY_KEYS)[number];
export type ScaleKey = (typeof SCALE_KEYS)[number];
export type SpaceKey = (typeof SPACE_KEYS)[number];
export type RadiusKey = (typeof RADIUS_KEYS)[number];
export type ShadowKey = (typeof SHADOW_KEYS)[number];
