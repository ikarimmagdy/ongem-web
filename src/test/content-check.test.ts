/// <reference types="node" />
import { join } from 'node:path';
// @ts-expect-error a plain node script, without types
import { findings, readsAsCopy } from '../../scripts/check-content.mjs';

/** OG-033 R1: no authored text stays in the web's code; every text is a content entry read by key. */
describe('no authored text in src (OG-033 R1)', () => {
  it('check_script_finds_no_authored_sentence_AC_R1_1', () => {
    expect(findings(join(__dirname, '..', '..'))).toEqual([]);
  });

  it('check_script_catches_a_sentence_AC_R1_1', () => {
    expect(readsAsCopy('Your payment was sent.')).toBe(true);
    expect(readsAsCopy('Cancel')).toBe(true);
    expect(readsAsCopy('العربية')).toBe(true);
    expect(readsAsCopy('og-btn og-btn--primary og-btn--md')).toBe(false);
    expect(readsAsCopy('app.payments.title')).toBe(false);
    expect(readsAsCopy('0px 0px -8% 0px')).toBe(false);
  });
});
