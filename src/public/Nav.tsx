import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { Logo, useTheme } from '../design-system';
import { LanguageSwitch, t, tList } from '../i18n';
import { groupOf, legalSlugs, navGroups, navLinks, type NavGroup } from './content';
import { OTHER_REGION, SITE, siteOf } from './site';

export const SIGN_IN = '/sign-in';
export const SIGN_UP = '/sign-in?mode=sign-up';
export const DEMO = '/demo';

const current = (to: string, path?: string) =>
  to === path || (to === '/blog' && !!path?.startsWith('/blog/')) ? ('page' as const) : undefined;

/** Closes [onClose] on Escape (focus back to [button]) and on a click outside [root]. */
function useDismiss(
  open: boolean,
  onClose: () => void,
  root: RefObject<HTMLElement | null>,
  button: RefObject<HTMLButtonElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose();
      button.current?.focus();
    };
    const click = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', key);
    document.addEventListener('mousedown', click);
    return () => {
      document.removeEventListener('keydown', key);
      document.removeEventListener('mousedown', click);
    };
  }, [open, onClose, root, button]);
}

/** One header menu: a disclosure button and its list of links (OG-034 R3), not an ARIA menu, so links stay links. */
function Menu({
  group,
  path,
  open,
  onToggle,
  onClose,
}: {
  group: NavGroup;
  path?: string;
  open: boolean;
  onToggle(): void;
  onClose(): void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useDismiss(open, onClose, root, button);
  const holds = groupOf(path) === group.id;
  return (
    <div className="pub-menu" ref={root}>
      <button
        ref={button}
        type="button"
        className={holds ? 'pub-nav__link pub-menu__button is-current' : 'pub-nav__link pub-menu__button'}
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        data-testid={`menu-${group.id}`}
        data-current={holds ? 'true' : undefined}
      >
        {group.label}
        <span className="pub-menu__chevron" aria-hidden="true" />
      </button>
      <ul id={id} className="pub-menu__list" hidden={!open} data-testid={`menu-list-${group.id}`}>
        {group.links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} aria-current={current(l.to, path)} onClick={onClose}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme, themes } = useTheme();
  const dark = theme.mode === 'dark';
  const target = themes.find((x) => (dark ? !x.id.endsWith('-dark') : x.id.endsWith('-dark')));
  if (!target) return null;
  return (
    <button
      type="button"
      className="pub-icon-btn"
      onClick={() => setTheme(target.id)}
      aria-label={dark ? t('web.labels.light_theme') : t('web.labels.dark_theme')}
      data-testid="theme-toggle"
    >
      <span aria-hidden="true">{dark ? '☀' : '☾'}</span>
    </button>
  );
}

/** The two regions: this one marked current, the other a link to its build (OG-034 R6). */
export function RegionLinks({ testid }: { testid?: string }) {
  const regions = (['US', 'AE'] as const).filter((r) => r === SITE.region || r === OTHER_REGION);
  return (
    <ul className="pub-region__list" data-testid={testid}>
      {regions.map((r) => {
        const key = r.toLowerCase();
        return (
          <li key={r}>
            {r === SITE.region ? (
              <span aria-current="true" className="pub-region__current">
                {t(`web.nav.region.${key}`)}
              </span>
            ) : (
              <a
                href={`${siteOf(r)}/`}
                hrefLang={key === 'ae' ? 'en-AE' : 'en-US'}
                data-testid={`region-${key}`}
              >
                {t(`web.nav.region.${key}`)}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function RegionChooser() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);
  useDismiss(open, close, root, button);
  const here = t(`web.nav.region.${SITE.region.toLowerCase()}`);
  return (
    <div className="pub-menu pub-region" ref={root}>
      <button
        ref={button}
        type="button"
        className="pub-icon-btn pub-region__button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={t('web.nav.region_label', { region: here })}
        onClick={() => setOpen((o) => !o)}
        data-testid="region-chooser"
      >
        {t(`web.nav.region_short.${SITE.region.toLowerCase()}`)}
      </button>
      <div id={id} className="pub-menu__list pub-region__panel" hidden={!open}>
        <p className="pub-menu__title">{t('web.nav.region_title')}</p>
        <RegionLinks />
      </div>
    </div>
  );
}

/** Get started, or, where accounts are not open yet (the UAE, OG-034 R7), Talk to us. */
export function PrimaryCta({
  testid,
  className = 'og-btn og-btn--primary og-btn--md',
}: {
  testid?: string;
  className?: string;
}) {
  return SITE.live ? (
    <Link to={SIGN_UP} className={className} data-testid={testid}>
      {t('web.hero.primary')}
    </Link>
  ) : (
    <Link to="/contact" className={className} data-testid={testid}>
      {t('web.soon.talk')}
    </Link>
  );
}

export function DemoLink({
  testid,
  className = 'og-btn og-btn--secondary og-btn--md',
}: {
  testid?: string;
  className?: string;
}) {
  return (
    <Link to={DEMO} className={className} data-testid={testid}>
      {t('web.nav.demo')}
    </Link>
  );
}

/** The site header (OG-034 R3); sign-in uses it too, with no page marked current. */
export function Header({ path }: { path?: string }) {
  const [phone, setPhone] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const groups = navGroups();
  const [product, who, resources] = groups as [NavGroup, NavGroup, NavGroup];
  const menuOf = (g: NavGroup) => (
    <Menu
      key={g.id}
      group={g}
      path={path}
      open={menu === g.id}
      onToggle={() => setMenu((m) => (m === g.id ? null : g.id))}
      onClose={() => setMenu((m) => (m === g.id ? null : m))}
    />
  );
  const links = navLinks().map((l) => (
    <Link key={l.to} to={l.to} className="pub-nav__link" aria-current={current(l.to, path)}>
      {l.label}
    </Link>
  ));
  return (
    <header className="pub-header">
      <div className="pub-wrap pub-header__row">
        <Link to="/" className="pub-brand" aria-label={t('web.labels.home_link')}>
          <Logo />
        </Link>
        <nav aria-label={t('web.labels.site_nav')} className="pub-nav" data-testid="pub-nav">
          {menuOf(product)}
          {menuOf(who)}
          {links}
          {menuOf(resources)}
        </nav>
        <div className="pub-header__tools">
          <RegionChooser />
          <LanguageSwitch className="pub-icon-btn pub-lang" />
          <ThemeToggle />
        </div>
        <div className="pub-header__actions">
          <Link
            to={SIGN_IN}
            className="og-btn og-btn--ghost og-btn--md pub-nav__signin"
            data-testid="pub-sign-in"
          >
            {t('web.hero.secondary')}
          </Link>
          <DemoLink testid="pub-demo" className="og-btn og-btn--secondary og-btn--md pub-header__demo" />
          <PrimaryCta
            testid="pub-get-started"
            className="og-btn og-btn--primary og-btn--md pub-header__start"
          />
        </div>
        <button
          type="button"
          className="pub-icon-btn pub-menu-btn"
          aria-expanded={phone}
          aria-controls="pub-phone-nav"
          aria-label={phone ? t('web.labels.close_menu') : t('web.labels.open_menu')}
          onClick={() => setPhone((o) => !o)}
          data-testid="phone-menu-button"
        >
          <span aria-hidden="true">{phone ? '✕' : '☰'}</span>
        </button>
      </div>
      <div id="pub-phone-nav" className="pub-phone-nav" hidden={!phone} data-testid="pub-phone-nav">
        <div className="pub-wrap">
          {groups.map((g) => (
            <section key={g.id} className="pub-phone-nav__group" aria-label={g.label}>
              <p className="pub-menu__title">{g.label}</p>
              <ul>
                {g.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} aria-current={current(l.to, path)} onClick={() => setPhone(false)}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <ul className="pub-phone-nav__flat">
            {navLinks().map((l) => (
              <li key={l.to}>
                <Link to={l.to} aria-current={current(l.to, path)} onClick={() => setPhone(false)}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          {phone && (
            <div className="pub-phone-nav__chooser">
              <p className="pub-menu__title">{t('web.footer.region_language')}</p>
              <RegionLinks />
              <div className="pub-phone-nav__lang">
                <LanguageSwitch className="pub-icon-btn pub-lang" />
                <ThemeToggle />
              </div>
            </div>
          )}
          <div className="pub-cta-row">
            <PrimaryCta />
            <DemoLink />
            <Link to={SIGN_IN} className="og-btn og-btn--ghost og-btn--md">
              {t('web.hero.secondary')}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

/** The site footer (OG-034 R5): five columns, the regulatory text and the region and language chooser. */
export function Footer() {
  const legal = legalSlugs();
  const groups = navGroups();
  const company = [
    { to: '/contact', label: t('web.nav.contact') },
    { to: '/security', label: t('web.nav.security') },
    { to: '/pricing', label: t('web.nav.pricing') },
  ];
  const columns: Array<{ id: string; label: string; links: Array<{ to: string; label: string }> }> = [
    groups[0]!,
    groups[1]!,
    { id: 'company', label: t('web.footer.company'), links: company },
    groups[2]!,
    {
      id: 'legal',
      label: t('web.legal.nav'),
      links: [
        ...legal.map((slug) => ({ to: `/legal/${slug}`, label: t(`legal.${slug}.title`) })),
        ...(legal.includes('disclosures')
          ? []
          : [{ to: '#pub-disclosures', label: t('web.labels.disclosures') }]),
      ],
    },
  ];
  return (
    <footer className="pub-footer">
      <div className="pub-wrap">
        <div className="pub-footer__top">
          <Logo />
          <div className="pub-footer__chooser" data-testid="footer-chooser">
            <p className="pub-menu__title">{t('web.footer.region_language')}</p>
            <RegionLinks testid="footer-regions" />
            <LanguageSwitch variant="choice" />
          </div>
        </div>
        <div className="pub-footer__cols">
          {columns.map((c) => (
            <nav
              key={c.id}
              aria-label={c.label}
              className="pub-footer__col"
              data-testid={c.id === 'legal' ? 'pub-legal-links' : `footer-${c.id}`}
            >
              <p className="pub-menu__title">{c.label}</p>
              <ul>
                {c.links.map((l) => (
                  <li key={l.to}>
                    {l.to.startsWith('#') ? <a href={l.to}>{l.label}</a> : <Link to={l.to}>{l.label}</Link>}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <section aria-labelledby="pub-disclosures" className="pub-disclosures" data-testid="pub-disclosures">
          <h2 id="pub-disclosures" className="pub-disclosures__title">
            {t('web.labels.disclosures')}
          </h2>
          <p className="pub-bank">{t('web.bank_statement')}</p>
          <p className="pub-draft" data-testid="pub-draft-note">
            {t('web.disclosures.note')}
          </p>
          <ol>
            {tList('web.disclosures').map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ol>
          <p className="pub-copyright">{t('web.footer.copyright', { year: new Date().getFullYear() })}</p>
        </section>
      </div>
    </footer>
  );
}
