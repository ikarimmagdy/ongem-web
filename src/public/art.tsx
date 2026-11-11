import { t } from '../i18n';
import { useId, type ReactNode } from 'react';
import { formatMinor } from '../lib/format';
import { REGION_CONFIG } from '../region';
import brandMark from '../assets/ongem-favicon.png';
import { CardFace } from '../design-system';
import type { ArtName } from './content';

/** Sample amounts in the build's currency (US$48,250.00, or AED in the AE build). */
const sample = (amountMinor: number) => formatMinor({ amountMinor, currency: REGION_CONFIG.currency });

/**
 * Original OnGem illustrations (OG-032 R7): the faceted gem from the brand and simple product shapes, drawn only with
 * classes whose colours come from theme variables (public.css), so they follow light and dark themes.
 */

function Svg({
  label,
  children,
  view = '0 0 320 220',
}: {
  label: string;
  children: ReactNode;
  view?: string;
}) {
  return (
    <svg className="pub-art" viewBox={view} role="img" aria-label={label} focusable="false">
      {children}
    </svg>
  );
}

/** The brand mark from the logo file, never redrawn or recoloured (PS-016); 48 units square at scale 1. */
export function Gem({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <image href={brandMark} x={x} y={y} width={48 * s} height={48 * s} />;
}

function Panel({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect className="f-card s-border" x={x} y={y} width={w} height={h} rx="14" />;
}

function Bar({ x, y, w, cls = 'f-sunken' }: { x: number; y: number; w: number; cls?: string }) {
  return <rect className={cls} x={x} y={y} width={w} height="8" rx="4" />;
}

export function HeroArt() {
  const g = useId();
  return (
    <svg
      className="pub-art pub-art--hero"
      viewBox="0 0 520 420"
      role="img"
      aria-label={t('web.art.label.hero')}
    >
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop className="stop-deep" offset="0" />
          <stop className="stop-signature" offset="0.6" />
          <stop className="stop-soft" offset="1" />
        </linearGradient>
      </defs>
      <circle cx="300" cy="200" r="170" fill={`url(#${g})`} opacity="0.18" />
      <Panel x={40} y={70} w={360} h={250} />
      <rect className="f-tint" x="40" y="70" width="360" height="40" rx="14" />
      <Gem x={58} y={78} s={0.5} />
      <Bar x={96} y={86} w={80} cls="f-deep" />
      <text className="t-muted pub-art__label" x="64" y="146" fontSize="13">
        {t('web.art.operating_account')}
      </text>
      <text className="t-primary pub-art__money" x="64" y="180" fontSize="30">
        {sample(4_825_000)}
      </text>
      <rect className="f-tint-mint" x="64" y="200" width="150" height="26" rx="13" />
      <circle className="f-success" cx="80" cy="213" r="5" />
      <text className="t-on-tint pub-art__label" x="92" y="218" fontSize="12">
        {t('web.art.payment_settled')}
      </text>
      <polyline
        className="s-primary"
        points="230,290 270,262 300,272 340,226 380,236"
        fill="none"
        strokeWidth="4"
      />
      <Bar x={64} y={250} w={120} />
      <Bar x={64} y={268} w={90} />
      <Bar x={64} y={286} w={140} />
      <g transform="translate(360 130)">
        <rect className="f-inverse" x="0" y="0" width="130" height="250" rx="22" />
        <rect className="f-card" x="8" y="12" width="114" height="226" rx="16" />
        <rect fill={`url(#${g})`} x="18" y="30" width="94" height="58" rx="10" />
        <Gem x={26} y={38} s={0.4} />
        <Bar x={26} y={72} w={60} cls="f-card" />
        <Bar x={18} y={104} w={80} />
        <Bar x={18} y={122} w={60} />
        <rect className="f-primary" x="18" y="196" width="94" height="26" rx="13" />
        <text className="t-on-primary pub-art__label" x="40" y="213" fontSize="11">
          {t('web.art.approve')}
        </text>
      </g>
    </svg>
  );
}

export function ShieldArt() {
  return (
    <Svg label={t('web.art.label.shield')}>
      <path
        className="f-tint"
        d="M160 20 L250 52 L250 112 C250 160 210 192 160 206 C110 192 70 160 70 112 L70 52 Z"
      />
      <path
        className="s-primary"
        fill="none"
        strokeWidth="5"
        d="M160 34 L236 61 L236 112 C236 152 202 180 160 192 C118 180 84 152 84 112 L84 61 Z"
      />
      <Gem x={136} y={84} s={1} />
      <circle className="f-success" cx="232" cy="176" r="18" />
      <polyline className="s-on-success" points="223,176 230,183 242,169" fill="none" strokeWidth="4" />
    </Svg>
  );
}

export function PartnerArt() {
  return (
    <Svg label={t('web.art.label.partner')}>
      <Panel x={20} y={50} w={110} h={120} />
      <text className="t-muted pub-art__label" x="34" y="78" fontSize="12">
        {t('web.art.new_company')}
      </text>
      <Bar x={34} y={92} w={80} />
      <Bar x={34} y={110} w={60} />
      <Bar x={34} y={128} w={70} />
      <path
        className="s-primary"
        d="M140 110 C170 80 190 140 220 110"
        fill="none"
        strokeWidth="4"
        strokeDasharray="6 6"
      />
      <polygon className="f-primary" points="214,100 230,110 214,120" />
      <Panel x={232} y={50} w={70} h={120} />
      <Gem x={243} y={70} s={1} />
      <Bar x={244} y={134} w={46} cls="f-accent" />
    </Svg>
  );
}

const ART: Record<ArtName, () => ReactNode> = {
  accounts: () => (
    <Svg label={t('web.art.label.accounts')}>
      <Panel x={30} y={30} w={260} h={160} />
      <Gem x={48} y={46} s={0.6} />
      <text className="t-primary pub-art__money" x="48" y="112" fontSize="26">
        {sample(1_240_000)}
      </text>
      <Bar x={48} y={130} w={140} />
      <Bar x={48} y={148} w={100} />
      <rect className="f-tint-violet" x="200" y="132" width="70" height="40" rx="8" />
      <text className="t-on-tint" x="212" y="157" fontSize="11">
        PDF {/* content-check: ignore */}
      </text>
    </Svg>
  ),
  payments: () => (
    <Svg label={t('web.art.label.payments')}>
      {[60, 160, 260].map((cx, i) => (
        <g key={cx}>
          <circle className={i === 2 ? 'f-success' : 'f-primary'} cx={cx} cy="100" r="22" />
          <circle className="f-card" cx={cx} cy="100" r="9" />
        </g>
      ))}
      <line className="s-primary" x1="84" y1="100" x2="136" y2="100" strokeWidth="4" />
      <line className="s-success" x1="184" y1="100" x2="236" y2="100" strokeWidth="4" />
      <text className="t-muted pub-art__label" x="40" y="150" fontSize="12">
        {t('web.art.sent')}
      </text>
      <text className="t-muted pub-art__label" x="130" y="150" fontSize="12">
        {t('web.art.at_the_bank')}
      </text>
      <text className="t-muted pub-art__label" x="238" y="150" fontSize="12">
        {t('web.art.settled')}
      </text>
    </Svg>
  ),
  topup: () => (
    <Svg label={t('web.art.label.topup')}>
      <path className="f-tint" d="M30 90 L90 60 L150 90 Z" />
      {[44, 76, 108, 136].map((x) => (
        <rect key={x} className="f-primary" x={x} y="94" width="10" height="56" rx="3" />
      ))}
      <rect className="f-primary" x="34" y="150" width="116" height="10" rx="4" />
      <path className="s-accent" d="M160 120 L220 120" strokeWidth="5" fill="none" />
      <polygon className="f-accent" points="216,108 236,120 216,132" />
      <Panel x={240} y={70} w={60} h={100} />
      <Gem x={246} y={96} s={1} />
    </Svg>
  ),
  // Two virtual cards on the design system's branded face (PS-003): navy base, gem gradient detail, wordmark,
  // Business, a different last four each. No physical card while physical cards are coming soon.
  cards: () => (
    <div className="pub-cardart" role="img" aria-label={t('web.art.label.cards')}>
      <span className="pub-cardart__card pub-cardart__card--back">
        <CardFace base="navy" kind={t('web.art.card_business')} holder={t('web.art.card_holder.1')} last4="4417" />
      </span>
      <span className="pub-cardart__card pub-cardart__card--front">
        <CardFace base="navy" kind={t('web.art.card_business')} holder={t('web.art.card_holder.2')} last4="2081" />
      </span>
    </div>
  ),
  approvals: () => (
    <Svg label={t('web.art.label.approvals')}>
      {[90, 230].map((cx, i) => (
        <g key={cx}>
          <circle className={i ? 'f-signature' : 'f-primary'} cx={cx} cy="80" r="26" />
          <circle className="f-card" cx={cx} cy="72" r="9" />
          <rect className="f-card" x={cx - 14} y="86" width="28" height="10" rx="5" />
        </g>
      ))}
      <path className="s-border-strong" d="M120 80 H200" strokeWidth="3" strokeDasharray="5 6" />
      <rect className="f-tint-mint" x="86" y="130" width="148" height="40" rx="20" />
      <polyline className="s-success" points="116,150 126,160 144,140" fill="none" strokeWidth="4" />
      <text className="t-on-tint pub-art__label" x="154" y="155" fontSize="12">
        {t('web.art.approved')}
      </text>
    </Svg>
  ),
  recipients: () => (
    <Svg label={t('web.art.label.recipients')}>
      <Panel x={50} y={30} w={220} h={160} />
      {[60, 100, 140].map((y, i) => (
        <g key={y}>
          <circle className={i === 1 ? 'f-accent' : 'f-tint'} cx="80" cy={y + 6} r="14" />
          <Bar x={104} y={y} w={100} />
          <circle className="f-success" cx="240" cy={y + 6} r="9" />
        </g>
      ))}
    </Svg>
  ),
  support: () => (
    <Svg label={t('web.art.label.support')}>
      <rect className="f-tint" x="40" y="40" width="170" height="60" rx="16" />
      <Bar x={58} y={60} w={120} cls="f-card" />
      <Bar x={58} y={76} w={80} cls="f-card" />
      <rect className="f-primary" x="110" y="116" width="170" height="60" rx="16" />
      <Bar x={128} y={136} w={120} cls="f-card" />
      <Bar x={128} y={152} w={60} cls="f-card" />
    </Svg>
  ),
  notifications: () => (
    <Svg label={t('web.art.label.notifications')}>
      <path
        className="f-primary"
        d="M160 40 C130 40 116 62 116 92 V120 L104 138 H216 L204 120 V92 C204 62 190 40 160 40 Z"
      />
      <circle className="f-primary" cx="160" cy="150" r="10" />
      <circle className="f-accent" cx="200" cy="54" r="14" />
      <text className="t-on-tint" x="195" y="59" fontSize="13">
        3
      </text>
    </Svg>
  ),
  assistant: () => (
    <Svg label={t('web.art.label.assistant')}>
      <Panel x={40} y={40} w={240} h={140} />
      <Gem x={56} y={56} s={0.6} />
      <Bar x={96} y={62} w={150} />
      <Bar x={96} y={80} w={110} />
      <rect className="f-tint-violet" x="56" y="110" width="208" height="50" rx="12" />
      <text className="t-on-tint pub-art__label" x="70" y="140" fontSize="12">
        {t('web.art.draft_ready')}
      </text>
    </Svg>
  ),
  companies: () => (
    <Svg label={t('web.art.label.companies')}>
      <Panel x={30} y={50} w={120} h={130} />
      <Panel x={170} y={50} w={120} h={130} />
      <Gem x={66} y={70} s={1} />
      <Gem x={206} y={70} s={1} />
      <Bar x={50} y={134} w={80} />
      <Bar x={190} y={134} w={80} />
      <Bar x={50} y={152} w={56} cls="f-accent" />
      <Bar x={190} y={152} w={56} cls="f-accent" />
      <circle className="f-primary" cx="160" cy="30" r="16" />
      <circle className="f-card" cx="160" cy="25" r="5" />
      <path
        className="s-border-strong"
        d="M150 40 L100 50 M170 40 L220 50"
        strokeWidth="2"
        strokeDasharray="4 5"
      />
    </Svg>
  ),
};

export function CapabilityArt({ name }: { name: ArtName }) {
  return <>{ART[name]()}</>;
}

/**
 * A soft light in the brand's signature colours behind dark bands (decorative, hidden from assistive technology). It is
 * no longer a gem: the mark is never redrawn (PS-016).
 */
export function GemGlow({ className }: { className?: string }) {
  const g = useId();
  return (
    <svg
      className={`pub-art pub-glow ${className ?? ''}`}
      viewBox="0 0 480 440"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={g} cx="0.5" cy="0.45" r="0.5">
          <stop className="stop-signature" offset="0" stopOpacity="0.5" />
          <stop className="stop-deep" offset="1" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="240" cy="200" rx="240" ry="200" fill={`url(#${g})`} />
    </svg>
  );
}

/** An original browser window frame around a product screen (OG-032 R10). */
export function BrowserFrame({ children, address }: { children: ReactNode; address: string }) {
  return (
    <div className="pub-browser">
      <svg
        className="pub-art pub-browser__bar"
        viewBox="0 0 600 28"
        preserveAspectRatio="xMinYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        <circle className="f-soft" cx="16" cy="14" r="5" />
        <circle className="f-accent" cx="34" cy="14" r="5" />
        <circle className="f-tint" cx="52" cy="14" r="5" />
        <rect className="f-sunken" x="76" y="6" width="300" height="16" rx="8" />
      </svg>
      <span className="pub-browser__address" aria-hidden="true">
        {address}
      </span>
      {children}
    </div>
  );
}

/** An original phone frame around a product screen (OG-032 R10). */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="pub-phone">
      <span className="pub-phone__notch" aria-hidden="true" />
      {children}
    </div>
  );
}
