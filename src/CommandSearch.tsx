import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Permission } from './api/client';
import { Modal } from './design-system';
import { useAsync } from './lib/useAsync';
import { NAV } from './nav';
import { t } from './i18n';
import { useSession } from './session';
import { useAssistantControl } from './assistant/control';
import { PAYMENT_TABS, visiblePaymentTabs } from './screens/Payments';
import { REGION_CONFIG } from './region';

interface Option {
  id: string;
  group: 'screens' | 'accounts' | 'recipients' | 'ask';
  label: string;
  hint?: string;
  to?: string;
}

const SHORTCUTS = 'Meta+K Control+K'; // content-check: ignore (key names)
/** Key caps, not words: the same in every language. */
const KEYCAP_MAC = '⌘ K'; // content-check: ignore (key cap)
const KEYCAP_OTHER = 'Ctrl K'; // content-check: ignore (key cap)

const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** True for Cmd K on a Mac and Ctrl K elsewhere (either is accepted everywhere). */
export const isSearchShortcut = (e: { key: string; metaKey: boolean; ctrlKey: boolean }) =>
  (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';

/**
 * The desktop command search (OG-035 R9): a button in the top bar and Cmd K or Ctrl K. It finds screens, accounts and
 * recipients by name, and with a query offers "Ask the assistant", which opens the assistant and sends the query.
 */
export function CommandSearch() {
  const { api, can, companyState } = useSession();
  const assistant = useAssistantControl();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const base = useId();
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (isSearchShortcut(e)) {
        e.preventDefault();
        // FA-033: never over another dialog (a step-up confirmation): the open dialog keeps the keyboard.
        if (document.querySelector('[aria-modal="true"]')) return;
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);
  const accounts = useAsync(() => (open ? api.accounts() : Promise.resolve([])), [api, open]);
  const recipients = useAsync(
    () => (open ? api.recipients().catch(() => []) : Promise.resolve([])),
    [api, open],
  );
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (s: string) => !q || s.toLowerCase().includes(q);
    const tabs = visiblePaymentTabs(can, companyState).filter((x) => x.id !== 'all');
    const screens: Option[] = [
      ...NAV.map((n) => ({ id: `screen-${n.id}`, group: 'screens' as const, label: n.label, to: n.to })),
      ...tabs.map((x) => ({
        id: `screen-payments-${x.id}`,
        group: 'screens' as const,
        label: t(`app.payments.tabs.${x.id}`),
        hint: t('app.nav.payments'),
        to: x.to,
      })),
      { id: 'screen-assistant', group: 'screens', label: t('app.assistant.title') },
      {
        id: 'screen-notifications',
        group: 'screens',
        label: t('app.nav.notifications'),
        to: '/notifications',
      },
    ];
    const accs: Option[] = (accounts.status === 'success' ? accounts.data : []).map((a) => ({
      id: `account-${a.id}`,
      group: 'accounts',
      label: a.name,
      hint: a.last4 ? REGION_CONFIG.accountMask(a.last4) : undefined,
      to: `/accounts/${a.id}`,
    }));
    const recs: Option[] = (recipients.status === 'success' ? recipients.data : []).map((r) => ({
      id: `recipient-${r.id}`,
      group: 'recipients',
      label: r.name,
      hint: REGION_CONFIG.accountMask(r.accountLast4),
      to: can(Permission.PAYMENT_CREATE)
        ? `/payments/new?recipient=${encodeURIComponent(r.id)}`
        : PAYMENT_TABS[3].to,
    }));
    const found = [
      ...screens.filter((o) => match(o.label) || (o.hint !== undefined && match(o.hint) && q.length > 0)),
      ...(q ? accs.filter((o) => match(o.label)) : []),
      ...(q ? recs.filter((o) => match(o.label)) : []),
    ];
    return q
      ? [...found, { id: 'ask', group: 'ask' as const, label: t('app.search.ask', { query: query.trim() }) }]
      : found;
  }, [query, accounts, recipients, can, companyState]);
  useEffect(() => setActive(0), [query]);
  const choose = (o: Option | undefined) => {
    if (!o) return;
    setOpen(false);
    if (o.group === 'ask') assistant.ask(query.trim());
    else if (o.id === 'screen-assistant') assistant.setOpen(true);
    else if (o.to) navigate(o.to);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(options[active]);
    }
  };
  const optionId = (o: Option) => `${base}-${o.id}`;
  const groups = (['screens', 'accounts', 'recipients', 'ask'] as const)
    .map((g) => ({ g, items: options.filter((o) => o.group === g) }))
    .filter((x) => x.items.length > 0);
  const current = options[active];
  return (
    <>
      <button
        type="button"
        className="fw-search"
        data-testid="command-search-open"
        aria-haspopup="dialog"
        aria-keyshortcuts={SHORTCUTS}
        onClick={() => setOpen(true)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span>{t('app.search.open')}</span>
        <kbd className="fw-search__kbd">{isMac() ? KEYCAP_MAC : KEYCAP_OTHER}</kbd>
      </button>
      <Modal open={open} title={t('app.search.title')} onClose={() => setOpen(false)}>
        <div className="fw-palette" data-testid="command-search">
          <input
            className="og-input fw-palette__input"
            data-testid="command-search-input"
            role="combobox"
            aria-label={t('app.search.label')}
            aria-expanded="true"
            aria-controls={`${base}-list`}
            aria-autocomplete="list"
            aria-activedescendant={current ? optionId(current) : undefined}
            placeholder={t('app.search.placeholder')}
            value={query}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div
            id={`${base}-list`}
            role="listbox"
            aria-label={t('app.search.title')}
            className="fw-palette__list"
          >
            {groups.length === 0 && <p className="fw-row__sub">{t('app.search.empty')}</p>}
            {groups.map(({ g, items }) => (
              <div key={g} role="group" aria-labelledby={`${base}-g-${g}`} className="fw-palette__group">
                {g !== 'ask' && (
                  <div id={`${base}-g-${g}`} className="fw-palette__heading" role="presentation">
                    {t(`app.search.group.${g}`)}
                  </div>
                )}
                {g === 'ask' && (
                  <span id={`${base}-g-${g}`} className="og-visually-hidden">
                    {t('app.assistant.title')}
                  </span>
                )}
                {items.map((o) => (
                  <div
                    key={o.id}
                    id={optionId(o)}
                    role="option"
                    aria-selected={o === current}
                    className={`fw-palette__option${o === current ? ' is-active' : ''}`}
                    data-testid={`search-option-${o.id}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                  >
                    <span>{o.label}</span>
                    {o.hint && (
                      <span className="fw-row__sub" data-mask={o.group === 'screens' ? undefined : ''}>
                        {o.hint}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
