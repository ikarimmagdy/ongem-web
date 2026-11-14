import { useEffect, useRef, useState } from 'react';
import { Button, Modal } from '../design-system';
import { t, tn } from '../i18n';
import { startIdleWatch, type IdleState, type IdleWatch } from '../lib/idle';
import { useSession } from '../session';

/** OG-042: Volume 7 states no value; 30 minutes for the founder web app, warned 60 seconds before. */
export const IDLE_TIMEOUT_MS = 30 * 60_000;
export const IDLE_WARNING_MS = 60_000;
export const IDLE_STORAGE_KEY = 'ongem.idle.last';

/** Signs a live session out (Clerk, through the session's leave) after [timeoutMs] without activity in any tab. */
export function IdleLogout({
  timeoutMs = IDLE_TIMEOUT_MS,
  warnMs = IDLE_WARNING_MS,
}: {
  timeoutMs?: number;
  warnMs?: number;
}) {
  const { mode, leave } = useSession();
  const live = mode === 'live';
  const [state, setState] = useState<IdleState | null>(null);
  const watch = useRef<IdleWatch | null>(null);
  const out = useRef(leave);
  out.current = leave;

  useEffect(() => {
    if (!live) return;
    watch.current = startIdleWatch({
      timeoutMs,
      warnMs,
      storageKey: IDLE_STORAGE_KEY,
      onChange: (s) => {
        setState(s);
        if (s.phase === 'expired') out.current();
      },
    });
    return () => {
      watch.current?.stop();
      watch.current = null;
    };
  }, [live, timeoutMs, warnMs]);

  const stay = () => watch.current?.touch();
  return (
    <Modal
      open={live && state?.phase === 'warning'}
      title={t('app.idle.title')}
      onClose={stay}
      footer={
        <>
          <Button variant="secondary" onClick={leave}>
            {t('app.common.sign_out')}
          </Button>
          <Button data-testid="idle-stay" onClick={stay}>
            {t('app.idle.stay')}
          </Button>
        </>
      }
    >
      <p data-testid="idle-warning" aria-live="polite">
        {tn('app.idle.text', Math.ceil((state?.remainingMs ?? 0) / 1000))}
      </p>
    </Modal>
  );
}
