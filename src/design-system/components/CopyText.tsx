import { useState } from 'react';
import { Button } from './Button';

/** A value shown as-is with a button that copies it, for ids people send to each other. */
export function CopyText({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <span className="og-copy">
      <code className="og-mono og-copy__value">{value}</code>
      <Button variant="ghost" size="sm" onClick={copy} aria-label={`Copy ${label}`}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </span>
  );
}
