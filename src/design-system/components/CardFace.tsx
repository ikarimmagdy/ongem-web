import type { ReactNode } from 'react';
import { BRAND_ASSETS, BRAND_ASSET_ON_DARK, BRAND_ASSET_SIZES } from '../../assets';
import { useTheme } from '../theme/ThemeProvider';

export interface CardFaceProps {
  /** The card's last four digits; never a full number. */
  last4?: string | null;
  /** The name on the card, shown as a label. */
  holder: ReactNode;
  /** What kind of card, in the reader's words ("Virtual", "Physical"). */
  kind: ReactNode;
  /** Brand V2 section 08: deep navy for virtual cards, white for physical ones. */
  base?: 'navy' | 'white';
  /** A frozen card keeps its face under a frost layer with a lock and [frozenLabel]. */
  frozen?: boolean;
  frozenLabel?: ReactNode;
  /** Other states (Pending, Closed) as a small label on the face. */
  status?: ReactNode;
  /** The card network's mark, when known; an empty mark area otherwise. */
  network?: ReactNode;
  /** The selected card in a list gets a focus-coloured ring (the button around it carries aria-current). */
  selected?: boolean;
  size?: 'md' | 'lg';
}

/**
 * OnGem's card face (FA-001, Brand V2 section 08): a navy or white base, the brand gradient as one controlled corner
 * detail, the wordmark at the top start, chip and contactless mark, last four in tabular figures, the holder's name and
 * the network mark area at the bottom end. Theme tokens only, so a white-label theme gets its own face; logical sides,
 * so it mirrors in Arabic. Shared by the founder app and the public site.
 */
export function CardFace({
  last4,
  holder,
  kind,
  base = 'navy',
  frozen = false,
  frozenLabel,
  status,
  network,
  selected = false,
  size = 'md',
}: CardFaceProps) {
  const { theme } = useTheme();
  const named = theme.logo.wordmark;
  // The navy face always takes the light-ink wordmark; the white face the full-colour one.
  const file = named && base === 'navy' ? (BRAND_ASSET_ON_DARK[named] ?? named) : named;
  const src = file ? BRAND_ASSETS[file] : undefined;
  const dims = file ? BRAND_ASSET_SIZES[file] : undefined;
  const cls = [
    'og-cardface',
    `og-cardface--${base}`,
    `og-cardface--${size}`,
    frozen ? 'is-frozen' : '',
    selected ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} data-testid="card-face" data-base={base} data-frozen={frozen || undefined}>
      <span className="og-cardface__gem" aria-hidden="true" />
      <span className="og-cardface__top">
        {src ? (
          <img
            className="og-cardface__wordmark"
            src={src}
            alt={theme.logo.alt}
            width={dims?.width}
            height={dims?.height}
          />
        ) : (
          <span className="og-cardface__wordmark og-cardface__wordmark--text">{theme.logo.alt}</span>
        )}
        <span className="og-cardface__kind">{kind}</span>
      </span>
      <span className="og-cardface__middle" aria-hidden="true">
        <span className="og-cardface__chip" />
        <svg className="og-cardface__contactless" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M8 7.5a6 6 0 0 1 0 9M11.5 5a9.5 9.5 0 0 1 0 14M15 2.5a13 13 0 0 1 0 19" />
        </svg>
      </span>
      <span className="og-cardface__number" data-mask="">
        <span aria-hidden="true">•••• </span>
        {last4}
      </span>
      <span className="og-cardface__bottom">
        <span className="og-cardface__holder">{holder}</span>
        <span className="og-cardface__network" data-testid="card-face-network">
          {network ?? (
            <span className="og-cardface__network-mark" aria-hidden="true">
              <span />
              <span />
            </span>
          )}
        </span>
      </span>
      {status && !frozen && <span className="og-cardface__status">{status}</span>}
      {frozen && (
        <span className="og-cardface__frost">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span>{frozenLabel}</span>
        </span>
      )}
    </span>
  );
}
