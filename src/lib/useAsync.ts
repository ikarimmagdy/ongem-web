import { useCallback, useEffect, useState } from 'react';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'success'; data: T };

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload(): void } {
  const [state, setState] = useState<{ for: unknown; value: AsyncState<T> }>({
    for: null,
    value: { status: 'loading' },
  });
  const [n, setN] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  useEffect(() => {
    let alive = true;
    setState({ for: run, value: { status: 'loading' } });
    run().then(
      (data) => alive && setState({ for: run, value: { status: 'success', data } }),
      (error: unknown) => alive && setState({ for: run, value: { status: 'error', error } }),
    );
    return () => {
      alive = false;
    };
  }, [run, n]);

  const reload = useCallback(() => setN((x) => x + 1), []);
  // A result loaded for earlier deps is never shown for new ones: until the new load starts, it is loading.
  const value: AsyncState<T> = state.for === run ? state.value : { status: 'loading' };
  return { ...value, reload };
}
