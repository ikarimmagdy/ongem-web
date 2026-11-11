import { useId, useMemo, useState, type ReactNode } from 'react';
import { t } from '../../i18n/store';

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
  /** The caption is read by screen readers but not shown, where the card's title already names the table (FA-011). */
  hideCaption?: boolean;
}

export function Table<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
  initialSort,
  onRowClick,
  hideCaption = false,
}: TableProps<T>) {
  const captionId = useId();
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
    // FA-045: the scroller is a named region a keyboard can reach, so a wide table scrolls without a mouse.
    <div className="og-table-wrap" role="region" aria-labelledby={captionId} tabIndex={0}>
      <table className="og-table">
        <caption id={captionId} className={hideCaption ? 'og-visually-hidden' : 'og-table__caption'}>
          {caption}
        </caption>
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
                {empty ?? t('app.ds.nothing_to_show')}
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
