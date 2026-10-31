/** An ABA routing number: 9 digits whose weighted sum (3, 7, 1 repeating) is a multiple of 10. */
export function abaValid(routing: string): boolean {
  if (!/^\d{9}$/.test(routing)) return false;
  const w = [3, 7, 1];
  const sum = [...routing].reduce((s, d, i) => s + Number(d) * w[i % 3]!, 0);
  return sum % 10 === 0;
}
