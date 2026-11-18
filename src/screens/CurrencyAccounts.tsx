import { useEffect, useRef, useState } from 'react';
import type { Account, CurrencyAccountOptions, ReceivingDetails } from '../api/types';
import { errorText } from '../api/errors';
import { Button, Card, Field, Input, KeyValue, Modal, Notice, Select } from '../design-system';
import { t } from '../i18n';
import { useSession } from '../session';
import { CopyValue } from './fxCommon';

/** The nickname a currency account may carry (ongem-core: up to 40 characters). */
export const NICKNAME_MAX = 40;

/**
 * OG-054: open a currency account (EUR, GBP) at the bank the API names. Owners only (account:open), step-up
 * (account_open) and an Idempotency-Key; the new account's local details show once it is open.
 */
export function OpenCurrencyAccount({
  open,
  options,
  initial,
  onClose,
  onOpened,
}: {
  open: boolean;
  options: CurrencyAccountOptions;
  initial?: string | null;
  onClose(): void;
  onOpened(a: Account): void;
}) {
  const { api } = useSession();
  const choices = options.items.filter((o) => !o.open);
  const [currency, setCurrency] = useState(
    choices.some((o) => o.currency === initial) ? (initial as string) : '',
  );
  const [nickname, setNickname] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [opened, setOpened] = useState<Account | null>(null);
  const inFlight = useRef(false);
  const option = choices.find((o) => o.currency === currency);
  const tooLong = nickname.trim().length > NICKNAME_MAX;
  const close = () => {
    setOpened(null);
    setFailure(null);
    setTried(false);
    setNickname('');
    onClose();
  };
  const submit = async () => {
    setTried(true);
    if (!option || tooLong || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const a = await api.openCurrencyAccount({ currency, nickname: nickname.trim() || null });
      setOpened(a);
      onOpened(a);
    } catch (e) {
      setFailure(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      title={opened ? t('app.fx.open.done_title', { currency: opened.currency }) : t('app.fx.open.title')}
      onClose={close}
      closeLabel={t('app.common.close')}
    >
      {opened ? (
        <div data-testid="currency-account-opened">
          <p>{t('app.fx.open.done_text', { name: opened.name })}</p>
          {opened.receiving ? (
            <ReceivingDetailsCard account={opened} embedded autoShow />
          ) : (
            <p className="fw-row__sub">{t('app.fx.receiving.none')}</p>
          )}
          <div className="fw-actions">
            <Button data-testid="currency-account-done" onClick={close}>
              {t('app.fx.open.done')}
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="fw-form"
          noValidate
          data-testid="currency-account-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="fw-row__sub">{t('app.fx.open.intro')}</p>
          <Field
            label={t('app.fx.open.currency')}
            error={tried && !option ? t('app.fx.open.currency_error') : undefined}
            hint={
              option?.institutionName ? (
                <span data-testid="currency-account-institution">
                  {t('app.fx.open.held_at', { institution: option.institutionName })}
                </span>
              ) : undefined
            }
          >
            <Select
              data-testid="currency-account-currency"
              value={currency}
              onChange={setCurrency}
              options={[
                { value: '', label: t('app.fx.open.choose_currency') },
                ...choices.map((o) => ({ value: o.currency, label: o.currency })),
              ]}
            />
          </Field>
          <Field
            label={t('app.fx.open.nickname')}
            hint={t('app.fx.open.nickname_hint', { max: NICKNAME_MAX })}
            error={tooLong ? t('app.fx.open.nickname_error', { max: NICKNAME_MAX }) : undefined}
          >
            <Input
              data-testid="currency-account-nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </Field>
          {failure && <Notice status="failure">{failure}</Notice>}
          <div className="fw-actions">
            <Button variant="secondary" type="button" disabled={busy} onClick={close}>
              {t('app.fx.cancel')}
            </Button>
            <Button type="submit" data-testid="currency-account-submit" disabled={busy}>
              {t('app.fx.open.submit')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** The lines of receiving details for a scheme: IBAN and BIC, sort code and account, or routing and account. */
export function receivingLines(d: ReceivingDetails): { key: string; label: string; value: string }[] {
  const lines: { key: string; label: string; value: string | null | undefined }[] =
    d.scheme === 'IBAN'
      ? [
          { key: 'iban', label: t('app.fx.receiving.iban'), value: d.iban },
          { key: 'bic', label: t('app.fx.receiving.bic'), value: d.bic },
        ]
      : d.scheme === 'UK_SORT_CODE'
        ? [
            { key: 'sort-code', label: t('app.fx.receiving.sort_code'), value: d.sortCode },
            { key: 'account-number', label: t('app.fx.receiving.account_number'), value: d.accountNumber },
          ]
        : [
            { key: 'routing-number', label: t('app.fx.receiving.routing_number'), value: d.routingNumber },
            { key: 'account-number', label: t('app.fx.receiving.account_number'), value: d.accountNumber },
          ];
  return lines.filter((l): l is { key: string; label: string; value: string } => Boolean(l.value));
}

/**
 * An account's local details for a payer (GET /v1/accounts/{id}/receiving-details). Each read is audited, so they are
 * read when the founder asks for them, shown with copy buttons and never kept.
 */
export function ReceivingDetailsCard({
  account,
  embedded = false,
  autoShow = false,
}: {
  account: Account;
  embedded?: boolean;
  /** Read at once: right after the account was opened, when the founder came for exactly these. */
  autoShow?: boolean;
}) {
  const { api } = useSession();
  const [details, setDetails] = useState<ReceivingDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const show = () => {
    setBusy(true);
    setFailure(null);
    api
      .receivingDetails(account.id)
      .then(setDetails, (e: unknown) => setFailure(errorText(e)))
      .finally(() => setBusy(false));
  };
  useEffect(() => {
    if (autoShow) show();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoShow, account.id]);
  const body = (
    <div data-testid="receiving-details">
      {details ? (
        <>
          <KeyValue
            items={[
              ...(details.beneficiaryName
                ? [
                    {
                      label: t('app.fx.receiving.beneficiary'),
                      value: (
                        <CopyValue
                          label={t('app.fx.receiving.beneficiary')}
                          value={details.beneficiaryName}
                          testId="receiving-beneficiary"
                        />
                      ),
                    },
                  ]
                : []),
              ...receivingLines(details).map((l) => ({
                label: l.label,
                value: (
                  <CopyValue
                    label={l.label}
                    value={l.value}
                    display={l.key === 'iban' ? l.value.replace(/(.{4})(?=.)/g, '$1 ') : undefined}
                    testId={`receiving-${l.key}`}
                  />
                ),
              })),
              ...(details.bankName
                ? [
                    {
                      label: t('app.fx.receiving.bank'),
                      value: <span data-testid="receiving-bank">{details.bankName}</span>,
                    },
                  ]
                : []),
            ]}
          />
          <p className="fw-row__sub">{t('app.fx.receiving.note', { currency: details.currency })}</p>
          <div className="fw-actions">
            <Button
              variant="secondary"
              size="sm"
              data-testid="receiving-hide"
              onClick={() => setDetails(null)}
            >
              {t('app.fx.receiving.hide')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="fw-row__sub">{t('app.fx.receiving.intro', { currency: account.currency })}</p>
          <div className="fw-actions">
            <Button variant="secondary" data-testid="receiving-show" disabled={busy} onClick={show}>
              {t('app.fx.receiving.show')}
            </Button>
          </div>
        </>
      )}
      {failure && <Notice status="failure">{failure}</Notice>}
    </div>
  );
  return embedded ? body : <Card title={t('app.fx.receiving.title')}>{body}</Card>;
}
