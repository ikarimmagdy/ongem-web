import { useMemo, useState, type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render(row: T): ReactNode;
  sortValue?(row: T): string | number;
  align?: 'start' | 'end';
}

export interface TableProps<T> {
  caption: ReactNode;
  columns: Column<T>[];
  rows: T[];
  rowKey(row: T): string;
  empty?: ReactNode;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  onRowClick?(row: T): void;
}

export function Table<T>({ caption, columns, rows, rowKey, empty, initialSort, onRowClick }: TableProps<T>) {
  const [sort, setSort] = useState(initialSort);
  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!col?.sortValue || !sort) return rows;
    const get = col.sortValue;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [rows, columns, sort]);

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  return (
    <div className="og-table-wrap">
      <table className="og-table">
        <caption className="og-table__caption">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const ariaSort =
                sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={c.align === 'end' ? 'og-num' : undefined}
                >
                  {c.sortValue ? (
                    <button type="button" className="og-table__sort" onClick={() => toggle(c.key)}>
                      {c.header}
                      <span aria-hidden="true" className="og-table__sort-mark">
                        {ariaSort === 'ascending' ? '▲' : ariaSort === 'descending' ? '▼' : '↕'}
                      </span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="og-table__empty">
                {empty ?? 'Nothing to show.'}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? 'og-table__row--link' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={c.align === 'end' ? 'og-num' : undefined}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
