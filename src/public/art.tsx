import { useId, type ReactNode } from 'react';
import type { ArtName } from './content';

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

/** The brand gem: a cut stone of five facets. */
export function Gem({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <polygon className="f-signature" points="0,14 14,0 34,0 48,14 24,44" />
      <polygon className="f-primary" points="0,14 14,0 24,14" />
      <polygon className="f-soft" points="24,14 34,0 48,14" />
      <polygon className="f-deep" points="0,14 24,14 24,44" />
      <polygon className="f-accent" points="24,14 48,14 24,44" opacity="0.85" />
    </g>
  );
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
      aria-label="OnGem on a laptop and a phone"
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
      <text className="t-muted" x="64" y="146" fontSize="13">
        Operating account
      </text>
      <text className="t-primary pub-art__money" x="64" y="180" fontSize="30">
        US$48,250.00
      </text>
      <rect className="f-tint-mint" x="64" y="200" width="150" height="26" rx="13" />
      <circle className="f-success" cx="80" cy="213" r="5" />
      <text className="t-on-tint" x="92" y="218" fontSize="12">
        Payment settled
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
        <text className="t-on-primary" x="26" y="80" fontSize="10">
          •••• 2412
        </text>
        <Bar x={18} y={104} w={80} />
        <Bar x={18} y={122} w={60} />
        <rect className="f-primary" x="18" y="196" width="94" height="26" rx="13" />
        <text className="t-on-primary" x="40" y="213" fontSize="11">
          Approve
        </text>
      </g>
    </svg>
  );
}

export function ShieldArt() {
  return (
    <Svg label="A shield with the OnGem gem">
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
    <Svg label="A company passing its details to OnGem">
      <Panel x={20} y={50} w={110} h={120} />
      <text className="t-muted" x="34" y="78" fontSize="12">
        New company
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
    <Svg label="Account balance and statement">
      <Panel x={30} y={30} w={260} h={160} />
      <Gem x={48} y={46} s={0.6} />
      <text className="t-primary pub-art__money" x="48" y="112" fontSize="26">
        US$12,400.00
      </text>
      <Bar x={48} y={130} w={140} />
      <Bar x={48} y={148} w={100} />
      <rect className="f-tint-violet" x="200" y="132" width="70" height="40" rx="8" />
      <text className="t-on-tint" x="212" y="157" fontSize="11">
        PDF
      </text>
    </Svg>
  ),
  payments: () => (
    <Svg label="A payment moving from sent to settled">
      {[60, 160, 260].map((cx, i) => (
        <g key={cx}>
          <circle className={i === 2 ? 'f-success' : 'f-primary'} cx={cx} cy="100" r="22" />
          <circle className="f-card" cx={cx} cy="100" r="9" />
        </g>
      ))}
      <line className="s-primary" x1="84" y1="100" x2="136" y2="100" strokeWidth="4" />
      <line className="s-success" x1="184" y1="100" x2="236" y2="100" strokeWidth="4" />
      <text className="t-muted" x="40" y="150" fontSize="12">
        Sent
      </text>
      <text className="t-muted" x="130" y="150" fontSize="12">
        At the bank
      </text>
      <text className="t-muted" x="238" y="150" fontSize="12">
        Settled
      </text>
    </Svg>
  ),
  topup: () => (
    <Svg label="Money pulled in from another bank">
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
  cards: () => {
    const Card = ({ x, y, cls }: { x: number; y: number; cls: string }) => (
      <g transform={`translate(${x} ${y})`}>
        <rect className={cls} width="170" height="106" rx="14" />
        <Gem x={14} y={14} s={0.55} />
        <text className="t-on-primary" x="16" y="88" fontSize="12">
          •••• 2412
        </text>
      </g>
    );
    return (
      <Svg label="Two virtual cards, one frozen">
        <Card x={40} y={40} cls="f-primary" />
        <Card x={110} y={80} cls="f-signature" />
        <circle className="f-card s-border" cx="268" cy="70" r="24" />
        <path className="s-primary" d="M268 56 V84 M256 63 L280 77 M256 77 L280 63" strokeWidth="3" />
      </Svg>
    );
  },
  approvals: () => (
    <Svg label="A maker and an approver">
      {[90, 230].map((cx, i) => (
        <g key={cx}>
          <circle className={i ? 'f-signature' : 'f-primary'} cx={cx} cy="80" r="26" />
          <circle className="f-card" cx={cx} cy="72" r="9" />
          <rect className="f-card" x={cx - 14} y="86" width="28" height="10" rx="5" />
        </g>
      ))}
      <path className="s-border-strong" d="M120 80 H200" strokeWidth="3" strokeDasharray="5 6" />
      <rect className="f-tint-mint" x="100" y="130" width="120" height="40" rx="20" />
      <polyline className="s-success" points="128,150 138,160 156,140" fill="none" strokeWidth="4" />
      <text className="t-on-tint" x="164" y="155" fontSize="12">
        Approved
      </text>
    </Svg>
  ),
  recipients: () => (
    <Svg label="A list of screened recipients">
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
    <Svg label="A support conversation">
      <rect className="f-tint" x="40" y="40" width="170" height="60" rx="16" />
      <Bar x={58} y={60} w={120} cls="f-card" />
      <Bar x={58} y={76} w={80} cls="f-card" />
      <rect className="f-primary" x="110" y="116" width="170" height="60" rx="16" />
      <Bar x={128} y={136} w={120} cls="f-card" />
      <Bar x={128} y={152} w={60} cls="f-card" />
    </Svg>
  ),
  notifications: () => (
    <Svg label="An inbox of notices">
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
    <Svg label="An assistant drafting a payment">
      <Panel x={40} y={40} w={240} h={140} />
      <Gem x={56} y={56} s={0.6} />
      <Bar x={96} y={62} w={150} />
      <Bar x={96} y={80} w={110} />
      <rect className="f-tint-violet" x="56" y="110" width="208" height="50" rx="12" />
      <text className="t-on-tint" x="70" y="140" fontSize="12">
        Draft ready: you review and send
      </text>
    </Svg>
  ),
};

export function CapabilityArt({ name }: { name: ArtName }) {
  return <>{ART[name]()}</>;
}
