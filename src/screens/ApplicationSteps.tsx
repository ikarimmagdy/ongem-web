import { Link } from 'react-router-dom';
import { t } from '../i18n';
import { APPLICATION_STEPS, applicationStep } from '../lib/needs';
import { applicationSentence } from '../lib/states';

/**
 * The application's progress on Home while the account is not open (OG-035 R5): four steps with the current one marked,
 * the state in a sentence and one action. On a phone the action sits under the text (CSS).
 */
export function ApplicationSteps({ state }: { state: string }) {
  const current = applicationStep(state);
  if (current === null) return null;
  const name = (i: number) => t(`app.home.steps.${APPLICATION_STEPS[i]}`);
  return (
    <section className="fw-appsteps" data-testid="home-application" aria-label={t('app.home.steps.label')}>
      <div className="fw-appsteps__text">
        <ol className="fw-appsteps__list" data-testid="application-steps">
          {APPLICATION_STEPS.map((id, i) => {
            const n = i + 1;
            const where = n < current ? 'done' : n === current ? 'now' : 'later';
            return (
              <li
                key={id}
                className={`fw-appsteps__step is-${where}`}
                aria-current={where === 'now' ? 'step' : undefined}
                data-step={id}
              >
                <span className="fw-appsteps__marker" aria-hidden="true">
                  {n}
                </span>
                <span className="fw-appsteps__name">{name(i)}</span>
                <span className="og-visually-hidden">{t(`app.home.steps.${where}`)}</span>
              </li>
            );
          })}
        </ol>
        <p className="fw-appsteps__current" data-testid="application-current">
          {t('app.home.steps.current', { n: current, step: name(current - 1) })}
        </p>
        <p className="fw-appsteps__sentence">{applicationSentence(state)}</p>
      </div>
      <Link
        className="og-btn og-btn--primary og-btn--md fw-appsteps__action"
        to="/onboarding"
        data-testid="application-action"
      >
        {t('app.home.continue_application')}
      </Link>
    </section>
  );
}
