// content-check: data (SVG path data, no words)
export type Category = 'banking' | 'global' | 'cards' | 'compliance' | 'treasury';

const PATHS: Record<Category, string> = {
  banking: 'M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18M12 3l9 5H3z',
  global: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  cards: 'M3 6h18v12H3zM3 10h18M7 15h4',
  compliance: 'M12 3l8 3v6c0 5-4 8-8 9c-4-1-8-4-8-9V6zM9 12l2 2l4-4',
  treasury:
    'M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3s-3.1 3-7 3s-7-1.3-7-3zM5 6v4c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 10v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4M5 14v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4',
};

export function CategoryIcon({
  category,
  label,
  size = 'md',
}: {
  category: Category;
  label?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={`og-cat og-cat--${category} og-cat--${size}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={PATHS[category]} />
      </svg>
    </span>
  );
}
