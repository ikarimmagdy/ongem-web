import { useCallback, useEffect, useState } from 'react';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'success'; data: T };

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload(): void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [n, setN] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    run().then(
      (data) => alive && setState({ status: 'success', data }),
      (error: unknown) => alive && setState({ status: 'error', error }),
    );
    return () => {
      alive = false;
    };
  }, [run, n]);

  const reload = useCallback(() => setN((x) => x + 1), []);
  return { ...state, reload };
}
