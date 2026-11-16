import { useEffect, type RefObject } from 'react';

/**
 * Closes an open menu, list or panel on Escape (focus back to [button] when given) and on a press outside [root]. The
 * Escape key stops here, so a dialog under the menu stays open.
 */
export function useDismiss(
  open: boolean,
  onClose: () => void,
  root: RefObject<HTMLElement | null>,
  button?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
      button?.current?.focus();
    };
    const press = (e: PointerEvent | MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', key, true);
    document.addEventListener('mousedown', press);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('mousedown', press);
    };
  }, [open, onClose, root, button]);
}
