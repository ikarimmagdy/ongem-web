import { formatMoney, type MoneyValue } from '../../lib/format';

export function Money({ value, size = 'md' }: { value: MoneyValue; size?: 'md' | 'lg' | 'xl' }) {
  return <span className={`og-money og-money--${size}`}>{formatMoney(value)}</span>;
}
