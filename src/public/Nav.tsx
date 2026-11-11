import { useEffect, useId, useRef, useState, type FocusEvent, type RefObject } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BRAND_ASSET_ON_DARK, BRAND_ASSET_SIZES, BRAND_ASSETS } from '../assets';
import { Logo, useTheme } from '../design-system';
import { getLocale, LanguageSwitch, t, tList, useContent } from '../i18n';
import { groupOf, legalSlugs, legalTitle, navGroups, navLinks, type NavGroup } from './content';
import { inBothBuilds } from './seo';
import { isProduction, OTHER_REGION, SITE, siteOf } from './site';

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

/** Closes an open menu when focus moves out of it, by Tab or a click elsewhere (PS-026). */
const closeOnFocusOut =
  (open: boolean, onClose: () => void, root: RefObject<HTMLElement | null>) => (e: FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (open && next && root.current && !root.current.contains(next)) onClose();
  };

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
    <div className="pub-menu" ref={root} onBlur={closeOnFocusOut(open, onClose, root)}>
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

/** Sun and moon as drawn icons, not text characters (PS-042). */
function ThemeIcon({ dark }: { dark: boolean }) {
  return (
    <svg className="pub-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {dark ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </>
      ) : (
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      )}
    </svg>
  );
}

/** Light or dark theme; light stays the default (brand). In the phone panel it carries its words (PS-045). */
function ThemeToggle({ labelled = false }: { labelled?: boolean }) {
  const { theme, setTheme, themes } = useTheme();
  const dark = theme.mode === 'dark';
  const target = themes.find((x) => (dark ? !x.id.endsWith('-dark') : x.id.endsWith('-dark')));
  if (!target) return null;
  const label = dark ? t('web.labels.light_theme') : t('web.labels.dark_theme');
  return (
    <button
      type="button"
      className={labelled ? 'og-btn og-btn--secondary og-btn--md pub-theme-btn' : 'pub-icon-btn'}
      onClick={() => setTheme(target.id)}
      aria-label={labelled ? undefined : label}
      data-testid={labelled ? 'theme-toggle-labelled' : 'theme-toggle'}
    >
      <ThemeIcon dark={dark} />
      {labelled && <span>{label}</span>}
    </button>
  );
}

/** Three lines, or a cross when the phone panel is open. */
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg className="pub-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={open ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'} />
    </svg>
  );
}

/** The two regions: this one marked current, the other a link to its build (OG-034 R6). */
export function RegionLinks({ testid }: { testid?: string }) {
  const regions = (['US', 'AE'] as const).filter((r) => r === SITE.region || r === OTHER_REGION);
  useContent();
  const { pathname } = useLocation();
  // The same page in the other build where it has one, in the language the visitor reads (PS-028).
  const there = `${inBothBuilds(pathname) ? pathname : '/'}?lang=${getLocale()}`;
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
                href={`${siteOf(r)}${there}`}
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

/**
 * Get started, or, where accounts are not open yet (the UAE, OG-034 R7), Talk to us once OnGem has a public address.
 * Until then the UAE offers no Talk to us (PS-010): the demo is the primary action and this renders nothing.
 */
export const hasPrimaryCta = () => SITE.live || Boolean(SITE.contactEmail);

export function PrimaryCta({
  testid,
  className = 'og-btn og-btn--primary og-btn--md',
}: {
  testid?: string;
  className?: string;
}) {
  if (SITE.live)
    return (
      <Link to={SIGN_UP} className={className} data-testid={testid}>
        {t('web.hero.primary')}
      </Link>
    );
  if (!SITE.contactEmail) return null;
  return (
    <Link to="/contact" className={className} data-testid={testid}>
      {t('web.soon.talk')}
    </Link>
  );
}

/** Try the demo: secondary beside Get started, primary where the build has no other main action (PS-010). */
export function DemoLink({
  testid,
  className = 'og-btn og-btn--secondary og-btn--md',
}: {
  testid?: string;
  className?: string;
}) {
  const cls = hasPrimaryCta() ? className : className.replace('og-btn--secondary', 'og-btn--primary');
  return (
    <Link to={DEMO} className={cls} data-testid={testid}>
      {t('web.nav.demo')}
    </Link>
  );
}

/**
 * The phone panel (PS-027): an overlay under the header; Escape closes it and returns focus to its button, the page
 * behind is inert and does not scroll, and a new page closes it.
 */
function usePhonePanel(open: boolean, close: () => void, button: RefObject<HTMLButtonElement | null>) {
  const { pathname } = useLocation();
  useEffect(() => close(), [pathname, close]);
  useEffect(() => {
    if (!open) return;
    const behind = Array.from(document.querySelectorAll<HTMLElement>('.pub > main, .pub > .pub-footer'));
    behind.forEach((el) => el.setAttribute('inert', ''));
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
      button.current?.focus();
    };
    document.addEventListener('keydown', key);
    return () => {
      behind.forEach((el) => el.removeAttribute('inert'));
      root.style.overflow = overflow;
      document.removeEventListener('keydown', key);
    };
  }, [open, close, button]);
}

/** The site header (OG-034 R3); sign-in uses it too, with no page marked current. */
export function Header({ path }: { path?: string }) {
  const [phone, setPhone] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const phoneButton = useRef<HTMLButtonElement>(null);
  const [closePhone] = useState(() => () => setPhone(false));
  usePhonePanel(phone, closePhone, phoneButton);
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
          <DemoLink
            testid="pub-demo"
            className={
              hasPrimaryCta()
                ? 'og-btn og-btn--secondary og-btn--md pub-header__demo'
                : 'og-btn og-btn--secondary og-btn--md pub-header__demo pub-header__main'
            }
          />
          <PrimaryCta
            testid="pub-get-started"
            className="og-btn og-btn--primary og-btn--md pub-header__start pub-header__main"
          />
        </div>
        <button
          ref={phoneButton}
          type="button"
          className="pub-icon-btn pub-menu-btn"
          aria-expanded={phone}
          aria-controls="pub-phone-nav"
          aria-label={phone ? t('web.labels.close_menu') : t('web.labels.open_menu')}
          onClick={() => setPhone((o) => !o)}
          data-testid="phone-menu-button"
        >
          <MenuIcon open={phone} />
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
                <LanguageSwitch className="og-btn og-btn--secondary og-btn--md pub-lang" />
                <ThemeToggle labelled />
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

/** The wordmark in light ink for the navy footer in every theme (PS-025); the theme's name where it has no file. */
function FooterLogo() {
  const { theme } = useTheme();
  const named = theme.logo.wordmark;
  const file = named ? BRAND_ASSET_ON_DARK[named] : undefined;
  const src = file ? BRAND_ASSETS[file] : undefined;
  if (!src || !file) return <span className="og-logo og-logo--text">{theme.logo.alt}</span>;
  const size = BRAND_ASSET_SIZES[file];
  return (
    <span className="og-logo og-logo--image og-logo--ink pub-footer__logo">
      <img src={src} alt={theme.logo.alt} width={size?.width} height={size?.height} />
    </span>
  );
}

/**
 * The site footer (OG-034 R5): five columns, the regulatory text and the region and language chooser. The page you are
 * on is marked (PS-007). A production build leaves out the draft disclosures and their draft note (PS-002).
 */
export function Footer({ path }: { path?: string }) {
  const legal = legalSlugs();
  const groups = navGroups();
  const draft = !isProduction();
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
      links: legal.map((slug) => ({ to: `/legal/${slug}`, label: legalTitle(slug) })),
    },
  ];
  return (
    <footer className="pub-footer">
      <div className="pub-wrap">
        <div className="pub-footer__top">
          <FooterLogo />
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
                    <Link to={l.to} aria-current={current(l.to, path)}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <section
          aria-label={t('web.labels.disclosures')}
          className="pub-disclosures"
          data-testid="pub-disclosures"
        >
          <p className="pub-bank">{t('web.bank_statement')}</p>
          {draft && (
            <>
              <p className="pub-draft" data-testid="pub-draft-note">
                {t('web.disclosures.note')}
              </p>
              <ol data-testid="pub-draft-disclosures">
                {tList('web.disclosures').map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ol>
            </>
          )}
          <p className="pub-copyright">{t('web.footer.copyright', { year: new Date().getFullYear() })}</p>
        </section>
      </div>
    </footer>
  );
}
