import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadWhop } from '@whop/elements';
import {
  ActivityElement,
  Checkout,
  CheckoutElement,
  KycElement,
  Verifications,
  Wallet,
  WhopElements,
  WithdrawElement,
  type Appearance,
} from '@whop/elements-react';
import { errorText } from '../api/errors';
import { Notice } from '../design-system';
import { useTheme } from '../design-system/theme/ThemeProvider';
import { t } from '../i18n';
import { AcceptanceApi, minorFromMajor, type PayoutDestination } from './api';
import { elementsAppearance } from './appearance';

/**
 * The processor's embedded elements (OG-039), loaded only on the Get paid screen of a build with the feature on. Every
 * token comes from ongem-core, scoped to one surface and never to move money; the ads pixel and the elements' own usage
 * analytics are off (ADR-0053: no personal data to telemetry vendors). Withdraw is host-driven: the element collects the
 * amount and destination and OnGem's core makes the payout (step-up, audit).
 */
export function WhopProvider({
  environment,
  children,
}: {
  environment: 'sandbox' | 'production';
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const loader = useMemo(() => loadWhop(), []);
  const appearance = useMemo(() => elementsAppearance(theme) as Appearance, [theme]);
  return (
    <WhopElements
      elements={loader}
      environment={environment}
      appearance={appearance}
      skipPixel
      toasts={false}
    >
      {children}
    </WhopElements>
  );
}

function useToken(api: AcceptanceApi, surface: Parameters<AcceptanceApi['token']>[0]) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api
      .token(surface)
      .then((r) => live && setToken(r.token))
      .catch((e: unknown) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
  }, [api, surface]);
  return { token, error };
}

export function VerifySurface({
  api,
  accountId,
  kind,
  onDone,
}: {
  api: AcceptanceApi;
  accountId: string;
  kind: 'individual' | 'business';
  onDone(): void;
}) {
  return (
    <div data-testid={`acceptance-kyc-${kind}`}>
      <Verifications
        accountId={accountId}
        kind={kind}
        analytics={false}
        getToken={async () => (await api.token('VERIFY')).token}
      >
        <KycElement onCompleted={onDone} />
      </Verifications>
    </div>
  );
}

export function CheckoutSurface({ checkoutId, onPaid }: { checkoutId: string; onPaid(): void }) {
  return (
    <div data-testid="acceptance-checkout">
      <Checkout checkoutConfiguration={checkoutId} analytics={false} onComplete={onPaid}>
        <CheckoutElement />
      </Checkout>
    </div>
  );
}

export function ActivitySurface({ api, accountId }: { api: AcceptanceApi; accountId: string }) {
  const { token, error } = useToken(api, 'WALLET_ACTIVITY');
  if (error) return <Notice status="failure">{error}</Notice>;
  if (!token) return <p role="status">{t('app.get_paid.loading')}</p>;
  return (
    <div data-testid="acceptance-activity">
      <Wallet accountId={accountId} accessToken={token} currency="usd" analytics={false}>
        <ActivityElement />
      </Wallet>
    </div>
  );
}

/** The element's method shape from OnGem's masked destinations. */
function methodOf(d: PayoutDestination) {
  return {
    id: d.id,
    nickname: d.name,
    accountReference: d.last4 ? `****${d.last4}` : null,
    destinationCurrency: (d.currency ?? 'USD').toLowerCase(),
    isDefault: d.isDefault,
    deliveryType: 'bank',
    supportsStandard: true,
    supportsInstant: d.instant,
  };
}

export function WithdrawSurface({
  api,
  accountId,
  onPaidOut,
}: {
  api: AcceptanceApi;
  accountId: string;
  onPaidOut(): void;
}) {
  const { token, error } = useToken(api, 'WITHDRAW');
  const [methods, setMethods] = useState<PayoutDestination[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  useEffect(() => {
    api
      .destinations()
      .then(setMethods)
      .catch((e: unknown) => setFailure(errorText(e)));
  }, [api]);
  if (error || failure) return <Notice status="failure">{error ?? failure}</Notice>;
  if (!token || !methods) return <p role="status">{t('app.get_paid.loading')}</p>;
  return (
    <div data-testid="acceptance-withdraw">
      <Wallet accountId={accountId} accessToken={token} currency="usd" analytics={false}>
        <WithdrawElement
          methods={methods.map(methodOf)}
          succeeded={succeeded}
          onWithdrawalRequested={(r) => {
            setFailure(null);
            api
              .payout(
                minorFromMajor(r.amount),
                r.payoutMethodId,
                r.speed === 'instant' ? 'INSTANT' : 'STANDARD',
              )
              .then((p) => {
                if (p.status === 'REJECTED') setFailure(t('app.get_paid.withdraw_refused'));
                else {
                  setSucceeded(true);
                  onPaidOut();
                }
              })
              .catch((e: unknown) => setFailure(errorText(e)));
          }}
        />
      </Wallet>
    </div>
  );
}
