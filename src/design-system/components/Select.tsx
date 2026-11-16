import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
} from 'react';
import { useAnchor } from './useAnchor';
import { useDismiss } from './useDismiss';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'value' | 'onChange' | 'type'
> {
  options: SelectOption[];
  value: string;
  onChange(value: string): void;
}

/**
 * OG-050: the one select, drawn from the theme in every mode and direction instead of the browser's own list. A
 * select-only combobox (WAI-ARIA APG): the button keeps focus and names the chosen option; Arrow keys, Home, End,
 * Enter, Space and typing a letter open and move through the list; Enter, Space or Tab chooses; Escape closes. A
 * `<label htmlFor>` (Field) names it like a native select.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { options, value, onChange, className, disabled, id: idProp, onKeyDown, onClick, ...rest },
  ref,
) {
  const ownId = useId();
  const id = idProp ?? ownId;
  const listId = `${id}-list`;
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useImperativeHandle(ref, () => button.current!);
  const [open, setOpen] = useState(false);
  const chosen = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [active, setActive] = useState(chosen);
  const typed = useRef({ text: '', at: 0 });
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root, button);
  useAnchor(open, button, list);

  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  const show = (at: number) => {
    setActive(Math.min(Math.max(at, 0), options.length - 1));
    setOpen(true);
  };
  const pick = (at: number) => {
    const o = options[at];
    setOpen(false);
    if (o && o.value !== value) onChange(o.value);
  };
  const find = (key: string) => {
    const now = Date.now();
    const t = typed.current;
    t.text = now - t.at > 700 ? key : t.text + key;
    t.at = now;
    const from = open ? active : chosen;
    const text = t.text.toLocaleLowerCase();
    const order = options.map((_, i) => (from + (t.text.length === 1 ? 1 : 0) + i) % options.length);
    return order.find((i) => options[i]!.label.toLocaleLowerCase().startsWith(text));
  };

  const keys = (e: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || options.length === 0) return;
    const at = open ? active : chosen;
    const last = options.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) show(chosen);
        else if (e.altKey) pick(active);
        else setActive(Math.min(at + 1, last));
        return;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) show(chosen);
        else if (e.altKey) pick(active);
        else setActive(Math.max(at - 1, 0));
        return;
      case 'Home':
        e.preventDefault();
        show(0);
        return;
      case 'End':
        e.preventDefault();
        show(last);
        return;
      case 'PageDown':
        if (!open) return;
        e.preventDefault();
        setActive(Math.min(at + 10, last));
        return;
      case 'PageUp':
        if (!open) return;
        e.preventDefault();
        setActive(Math.max(at - 10, 0));
        return;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open) pick(active);
        else show(chosen);
        return;
      case 'Tab':
        if (open) pick(active);
        return;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const hit = find(e.key);
          if (hit !== undefined) show(hit);
        }
    }
  };

  const current = options[chosen];
  return (
    <div className="og-select" ref={root}>
      <button
        ref={button}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        data-value={value}
        disabled={disabled}
        className={['og-input', 'og-select__button', className].filter(Boolean).join(' ')}
        onKeyDown={keys}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented) return;
          if (open) setOpen(false);
          else show(chosen);
        }}
        {...rest}
      >
        <span className="og-select__value">{current?.label ?? ''}</span>
        <svg className="og-select__chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <ul ref={list} id={listId} role="listbox" className="og-select__list" tabIndex={-1}>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === chosen}
              data-index={i}
              data-value={o.value}
              className={i === active ? 'og-select__option is-active' : 'og-select__option'}
              onMouseMove={() => i !== active && setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                pick(i);
                button.current?.focus();
              }}
            >
              <span>{o.label}</span>
              {i === chosen && (
                <svg className="og-select__check" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
