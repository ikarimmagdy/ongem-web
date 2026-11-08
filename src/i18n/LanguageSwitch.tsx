import { useContent } from './hooks';
import { setLocale, t } from './store';
import type { Locale } from './types';

/**
 * English or العربية (OG-033 R10). The header shows one button for the other language; settings shows both choices.
 * Each language is named in its own script. [onChange] runs after the switch (signed in: PUT /v1/me/preferences).
 */
export function LanguageSwitch({
  variant = 'toggle',
  onChange,
  className,
}: {
  variant?: 'toggle' | 'choice';
  onChange?: (locale: Locale) => void;
  className?: string;
}) {
  const locale = useContent();
  const pick = (l: Locale) => {
    if (l === locale) return;
    void setLocale(l).then(() => onChange?.(l));
  };
  if (variant === 'toggle') {
    const other: Locale = locale === 'ar' ? 'en' : 'ar';
    return (
      <button
        type="button"
        className={className ?? 'pub-lang'}
        lang={other}
        onClick={() => pick(other)}
        aria-label={t(`web.lang.switch_to_${other}`)}
        data-testid="language-switch"
      >
        {t(`web.lang.${other}`)}
      </button>
    );
  }
  return (
    <div className="fw-lang" role="radiogroup" aria-label={t('web.lang.label')} data-testid="language-choice">
      {(['en', 'ar'] as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={l === locale}
          lang={l}
          className={l === locale ? 'og-btn og-btn--primary og-btn--md' : 'og-btn og-btn--secondary og-btn--md'}
          onClick={() => pick(l)}
          data-testid={`language-${l}`}
        >
          {t(`web.lang.${l}`)}
        </button>
      ))}
    </div>
  );
}
