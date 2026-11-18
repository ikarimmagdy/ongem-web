import { useEffect, useState, type ComponentProps } from 'react';
import { Permission } from '../api/client';
import type { Account, Corridor, CurrencyAccountOptions, FxQuote } from '../api/types';
import { Button, Input, KeyValue } from '../design-system';
import { formatMinor } from '../lib/format';
import { rateLine, secondsLeft } from '../lib/fx';
import { useAsync } from '../lib/useAsync';
import { t } from '../i18n';
import { useSession } from '../session';
import { PrefixedInput } from './common';

/** What the API says is on for this company (OG-054): each multi-currency feature shows only when it is. */
export interface FxFeatures {
  corridors: Corridor[];
  options: CurrencyAccountOptions;
  accounts: Account[];
  /** Corridors are offered: Send abroad. */
  abroad: boolean;
  /** The company holds active accounts in two currencies or more: Convert. */
  convert: boolean;
  /** Currency accounts are switched on, one can still be opened and this person may open it. */
  open: boolean;
}

const OFF: CurrencyAccountOptions = { enabled: false, items: [] };

export function useFxFeatures(reload = 0) {
  const { api, can } = useSession();
  const view = can(Permission.PAYMENT_VIEW);
  const opener = can(Permission.ACCOUNT_OPEN);
  return useAsync<FxFeatures>(async () => {
    const [corridors, options, accounts] = await Promise.all([
      view ? api.corridors().catch(() => []) : Promise.resolve([]),
      api.currencyAccountOptions().catch(() => OFF),
      api.accounts().catch(() => []),
    ]);
    const active = accounts.filter((a) => a.status === 'ACTIVE');
    return {
      corridors,
      options,
      accounts,
      abroad: corridors.length > 0,
      convert: new Set(active.map((a) => a.currency)).size > 1,
      open: opener && options.enabled && options.items.some((o) => !o.open),
    };
  }, [api, view, opener, reload]);
}

/** The amount field with the currency's own prefix (US$, EUR, JPY), never a fixed one. */
export function MoneyInput({ currency, ...rest }: { currency: string } & ComponentProps<typeof Input>) {
  const prefix =
    formatMinor({ amountMinor: 0, currency })
      .replace(/[\d.,\s\u00a0]/g, '')
      .trim() || currency;
  return <PrefixedInput {...rest} prefix={prefix} inputMode={rest.inputMode ?? 'decimal'} />;
}

/** Seconds left on a quote, counted down once a second. */
export function useCountdown(q: Pick<FxQuote, 'expiresAt'> | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!q) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [q]);
  return q ? secondsLeft(q, now) : 0;
}

/**
 * A quote in lines (OG-054): the rate, the provider's fee and OnGem's margin each on its own line, what leaves and what
 * arrives, and the time left to accept it.
 */
export function QuoteLines({ quote, left }: { quote: FxQuote; left: number }) {
  return (
    <div data-testid="fx-quote">
      <KeyValue
        items={[
          {
            label: t('app.fx.quote.rate'),
            value: (
              <bdi dir="ltr" data-testid="fx-quote-rate">
                {rateLine(quote)}
              </bdi>
            ),
          },
          {
            label: t('app.fx.quote.converted'),
            value: (
              <span className="og-money" data-mask="">
                {formatMinor(quote.sell)}
              </span>
            ),
          },
          {
            label: t('app.fx.quote.provider_fee'),
            value: (
              <span className="og-money" data-mask="" data-testid="fx-quote-fee">
                {formatMinor(quote.providerFee)}
              </span>
            ),
          },
          {
            label: t('app.fx.quote.margin', { bps: quote.marginBps }),
            value: (
              <span className="og-money" data-mask="" data-testid="fx-quote-margin">
                {formatMinor(quote.margin)}
              </span>
            ),
          },
          {
            label: t('app.fx.quote.total'),
            value: (
              <strong className="og-money" data-mask="" data-testid="fx-quote-total">
                {formatMinor(quote.totalDebit)}
              </strong>
            ),
          },
          {
            label: t('app.fx.quote.receive'),
            value: (
              <strong className="og-money" data-mask="" data-testid="fx-quote-receive">
                {formatMinor(quote.buy)}
              </strong>
            ),
          },
        ]}
      />
      <p className="fw-row__sub" role="timer" aria-live="off" data-testid="fx-quote-expiry">
        {left > 0 ? t('app.fx.quote.expires_in', { seconds: left }) : t('app.fx.quote.expired')}
      </p>
    </div>
  );
}

/** A value with a copy button that says Copied when it has copied (receiving details). */
export function CopyValue({
  label,
  value,
  testId,
  display,
}: {
  label: string;
  value: string;
  testId: string;
  /** How the value reads on screen (an IBAN in groups of four); the copy is always [value] as given. */
  display?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = () => {
    const done = () => setCopied(true);
    try {
      void navigator.clipboard?.writeText(value).then(done, () => undefined);
    } catch {
      /* no clipboard: the value stays on screen to copy by hand */
    }
  };
  return (
    <span className="fw-copy">
      <bdi dir="ltr" className="fw-copy__value" data-mask="" data-testid={testId}>
        {display ?? value}
      </bdi>
      <Button
        variant="ghost"
        size="sm"
        aria-label={t('app.fx.copy_named', { name: label })}
        data-testid={`${testId}-copy`}
        onClick={copy}
      >
        {copied ? t('app.ds.copied') : t('app.fx.copy')}
      </Button>
      <span className="og-visually-hidden" aria-live="polite">
        {copied ? t('app.ds.copied') : ''}
      </span>
    </span>
  );
}
