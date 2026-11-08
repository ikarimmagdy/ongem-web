import { Fragment, type ReactNode } from 'react';
import { Markdown } from './markdown';
import { t } from './store';

export * from './store';
export { useChannels, useContent } from './hooks';
export type { Channel, Locale } from './types';

/** A text whose placeholders are elements, such as an amount or a link: `<T k="..." vars={{ amount: <Money /> }} />`. */
export function T({ k, vars = {} }: { k: string; vars?: Record<string, ReactNode> }) {
  const parts = t(k).split(/(\{[a-zA-Z0-9_]+\})/);
  return (
    <>
      {parts.map((p, i) => {
        const name = /^\{([a-zA-Z0-9_]+)\}$/.exec(p)?.[1];
        return <Fragment key={i}>{name !== undefined && name in vars ? vars[name] : p}</Fragment>;
      })}
    </>
  );
}

/** A markdown entry, rendered as elements (never as HTML), so a text cannot inject markup. */
export function Md({ k, source }: { k?: string; source?: string }) {
  return <Markdown source={source ?? t(k ?? '')} />;
}

export { Markdown };
export { LanguageSwitch } from './LanguageSwitch';
