import { useNavigate } from 'react-router-dom';
import { t } from '../i18n';
import { useSession } from '../session';
import { SIGN_UP } from './Nav';
import { SITE } from './site';
import './demo-bar.css';

/**
 * The way out of the demo (PS-019): a thin bar over the signed-in shell in demo mode that says the data is sample data
 * and offers Get started (where accounts are open) and Back to the site. Nothing in demo mode reaches a bank.
 */
export function DemoBar() {
  const { mode, leave } = useSession();
  const navigate = useNavigate();
  if (mode !== 'demo') return null;
  const go = (to: string) => {
    navigate(to);
    leave();
  };
  return (
    <div className="pub-demobar" role="region" aria-label={t('web.demo.bar_label')} data-testid="demo-bar">
      <p className="pub-demobar__text">{t('web.demo.bar_text')}</p>
      <div className="pub-demobar__actions">
        {SITE.live && (
          <button
            type="button"
            className="og-btn og-btn--primary og-btn--sm"
            onClick={() => go(SIGN_UP)}
            data-testid="demo-get-started"
          >
            {t('web.hero.primary')}
          </button>
        )}
        <button
          type="button"
          className="og-btn og-btn--secondary og-btn--sm"
          onClick={() => go('/')}
          data-testid="demo-back-to-site"
        >
          {t('web.demo.back')}
        </button>
      </div>
    </div>
  );
}
