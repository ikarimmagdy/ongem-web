import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * The small markdown subset the blog uses (OG-032 R15): ## and ### headings, paragraphs, - and 1. lists, > quotes,
 * **bold**, *italic* or _italic_ and [links](to). Rendered as React elements, never as HTML strings, so post text cannot inject
 * markup. Links starting with / stay in the app; others open in a new tab.
 */
export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\b_([^_]+)_\b|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${m.index}`;
    if (m[1] !== undefined) out.push(<strong key={key}>{m[1]}</strong>);
    else if ((m[2] ?? m[3]) !== undefined) out.push(<em key={key}>{m[2] ?? m[3]}</em>);
    else {
      const [label, to] = [m[4]!, m[5]!];
      out.push(
        to.startsWith('/') ? (
          <Link key={key} to={to}>
            {label}
          </Link>
        ) : (
          <a key={key} href={to} target="_blank" rel="noreferrer noopener">
            {label}
          </a>
        ),
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.trim().split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (b.startsWith('### ')) return <h3 key={i}>{inline(b.slice(4))}</h3>;
        if (b.startsWith('## ')) return <h2 key={i}>{inline(b.slice(3))}</h2>;
        if (lines.every((l) => l.startsWith('- ')))
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.slice(2))}</li>
              ))}
            </ul>
          );
        if (lines.every((l) => /^\d+\. /.test(l)))
          return (
            <ol key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\d+\. /, ''))}</li>
              ))}
            </ol>
          );
        if (lines.every((l) => l.startsWith('> ')))
          return <blockquote key={i}>{inline(lines.map((l) => l.slice(2)).join(' '))}</blockquote>;
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && ' '}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
