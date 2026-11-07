/** A UAE IBAN: AE, 2 check digits, then 19 digits (3 for the bank, 16 for the account), with a valid mod-97 check. */
export function uaeIbanValid(iban: string): boolean {
  const t = normaliseIban(iban);
  if (!/^AE\d{21}$/.test(t)) return false;
  const moved = `${t.slice(4)}${t.slice(0, 4)}`.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of moved) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

/** Upper case without spaces, as typed IBANs often come grouped in fours. */
export const normaliseIban = (iban: string) => iban.replace(/\s+/g, '').toUpperCase();
