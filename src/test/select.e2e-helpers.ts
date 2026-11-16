import type { Locator } from '@playwright/test';

/** OG-050: the design-system Select is a combobox button with its own list, not a native select. */
async function list(select: Locator): Promise<Locator> {
  if ((await select.getAttribute('aria-expanded')) !== 'true') await select.click();
  const id = await select.getAttribute('aria-controls');
  return select.page().locator(`[id="${id}"]`);
}

/** Picks the option with [value], as a person does. */
export async function choose(select: Locator, value: string): Promise<void> {
  await (await list(select)).locator(`[role="option"][data-value="${value}"]`).click();
}

/** The values the Select offers, read by opening its list and closing it again. */
export async function optionValues(select: Locator): Promise<string[]> {
  const values = await (
    await list(select)
  )
    .locator('[role="option"]')
    .evaluateAll((o) => o.map((x) => (x as HTMLElement).dataset.value ?? ''));
  await select.click();
  return values;
}
