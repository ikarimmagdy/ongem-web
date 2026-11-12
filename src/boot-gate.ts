/**
 * PS-013: on the prerendered home the app's script waits until the hero screens have loaded, so they are not sharing a
 * slow phone connection with it; a tap or key press, or `waitMs`, starts it sooner. Any other page starts at once.
 */
export function afterHero(doc: Document, path: string, start: () => void, waitMs = 4000): void {
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    start();
  };
  const home = path === '/' ? doc.querySelector('[data-testid="public-home"]') : null;
  const pending = home
    ? Array.from(home.querySelectorAll<HTMLImageElement>('img[fetchpriority="high"]')).filter(
        (i) => !i.complete,
      )
    : [];
  if (!pending.length) return go();
  let left = pending.length;
  const one = () => {
    left -= 1;
    if (left === 0) go();
  };
  for (const img of pending) {
    img.addEventListener('load', one, { once: true });
    img.addEventListener('error', one, { once: true });
  }
  for (const type of ['pointerdown', 'keydown', 'touchstart'])
    doc.addEventListener(type, go, { once: true, capture: true, passive: true });
  setTimeout(go, waitMs);
}
