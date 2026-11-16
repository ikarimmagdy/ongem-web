import { useLayoutEffect, type RefObject } from 'react';

const GAP = 4;
const EDGE = 8;

/**
 * Places an open popup (a select's list, a date picker's calendar) under its trigger, or over it when there is more
 * room above. Where the browser has the Popover API the popup goes to the top layer, so a dialog's scroll area or the
 * inert page around a dialog never clips or blocks it; elsewhere it stays absolutely placed under the trigger.
 * [matchWidth] makes the popup as wide as the trigger. Logical sides are kept by placing from the viewport's left edge
 * with the trigger's own box, which is the same in both directions.
 */
export function useAnchor(
  open: boolean,
  trigger: RefObject<HTMLElement | null>,
  popup: RefObject<HTMLElement | null>,
  matchWidth = true,
) {
  useLayoutEffect(() => {
    const el = popup.current;
    const anchor = trigger.current;
    if (!open || !el || !anchor) return;
    const top = typeof el.showPopover === 'function';
    if (top && !el.hasAttribute('popover')) el.setAttribute('popover', 'manual');
    if (top && !el.matches(':popover-open')) el.showPopover();
    const place = () => {
      if (!top) return;
      el.style.position = 'fixed';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      const r = anchor.getBoundingClientRect();
      if (matchWidth) el.style.width = `${r.width}px`;
      const h = el.offsetHeight;
      const w = el.offsetWidth;
      const below = window.innerHeight - r.bottom;
      const up = below < h + GAP + EDGE && r.top > below;
      const rtl = anchor.closest('[dir]')?.getAttribute('dir') === 'rtl';
      const left = rtl ? r.right - w : r.left;
      el.style.left = `${Math.max(EDGE, Math.min(left, window.innerWidth - w - EDGE))}px`;
      el.style.top = `${up ? Math.max(EDGE, r.top - h - GAP) : r.bottom + GAP}px`;
      el.dataset.side = up ? 'top' : 'bottom';
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      if (top && el.isConnected && el.matches(':popover-open')) el.hidePopover();
    };
  }, [open, trigger, popup, matchWidth]);
}
