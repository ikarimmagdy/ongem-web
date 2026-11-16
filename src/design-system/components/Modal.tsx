import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  open: boolean;
  title: ReactNode;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  /** The title names the dialog for screen readers only (a search box that speaks for itself, FA-027). */
  hideTitle?: boolean;
  /** OG-050: a close button in the dialog's corner, named by this label; for dialogs with no footer action. */
  closeLabel?: string;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'; // content-check: ignore (CSS selector)

export function Modal({ open, title, onClose, children, footer, hideTitle = false, closeLabel }: ModalProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);

  // FA-033: while a dialog is open the page behind it is inert, so no shortcut, floating button or panel can take focus
  // or open over it; a dialog opened from another dialog leaves only the newest one live.
  useEffect(() => {
    if (!open) return;
    const own = backdrop.current;
    const made: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      if (el === own || el.hasAttribute('inert') || el.tagName === 'SCRIPT') continue;
      el.setAttribute('inert', '');
      made.push(el);
    }
    return () => made.forEach((el) => el.removeAttribute('inert'));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab' && node) {
        const list = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => !el.hasAttribute('disabled'),
        );
        if (list.length === 0) return;
        const firstEl = list[0];
        const lastEl = list[list.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl?.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      trigger?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      ref={backdrop}
      className="og-modal__backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        className="og-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={closeLabel ? 'og-modal__head' : undefined}>
          <h2 id={titleId} className={hideTitle ? 'og-visually-hidden' : 'og-modal__title'}>
            {title}
          </h2>
          {closeLabel && (
            <button type="button" className="og-modal__close" aria-label={closeLabel} onClick={onClose}>
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>
        <div className="og-modal__body">{children}</div>
        {footer && <div className="og-modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
