import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/types';
import { useToast } from '@/app/providers/ToastProvider';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  errorCode: string | null;
  /** True once a request has completed, successfully or not. */
  settled: boolean;
}

/**
 * Minimal server-state hook (spec §133: keep server state separate and
 * simple — no global store needed for this application's size).
 *
 * Handles: abort on unmount, stale-response guarding, retry, and
 * network-vs-application error distinction.
 */
export function useAsync<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
  options: { enabled?: boolean; initial?: T | null } = {},
) {
  const { enabled = true, initial = null } = options;
  const [state, setState] = useState<AsyncState<T>>({
    data: initial,
    loading: enabled,
    error: null,
    errorCode: null,
    settled: false,
  });

  const requestId = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  /** Every in-flight controller, so unmount cancels them all. */
  const inFlight = useRef(new Set<AbortController>());
  const mounted = useRef(true);

  const execute = useCallback(async (controller: AbortController) => {
    const id = ++requestId.current;
    inFlight.current.add(controller);
    setState((s) => ({ ...s, loading: true, error: null, errorCode: null }));
    try {
      const data = await fnRef.current(controller.signal);
      if (id === requestId.current && mounted.current) {
        setState({ data, loading: false, error: null, errorCode: null, settled: true });
      }
      return data;
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
      const apiError = error as ApiError;
      if (id === requestId.current && mounted.current) {
        setState({
          data: null,
          loading: false,
          error: apiError?.message ?? 'Something went wrong.',
          errorCode: apiError?.code ?? 'error',
          settled: true,
        });
      }
      throw error;
    } finally {
      inFlight.current.delete(controller);
    }
  }, []);

  /** Manual reload. Returns the data (and throws on failure) so callers can react. */
  const refetch = useCallback(async () => {
    const controller = new AbortController();
    return execute(controller);
  }, [execute]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const controller = new AbortController();
    execute(controller).catch(() => undefined);

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, execute, ...deps]);

  useEffect(
    () => () => {
      mounted.current = false;
      inFlight.current.forEach((controller) => controller.abort());
      inFlight.current.clear();
    },
    [],
  );

  const setData = useCallback((updater: T | ((prev: T | null) => T | null)) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? (updater as (p: T | null) => T | null)(s.data) : updater }));
  }, []);

  return { ...state, refetch, setData };
}

/**
 * Tracks a pending mutation with loading/error/success state (spec §84).
 *
 * Failures are NEVER silent. A write that fails because of a policy, a
 * missing permission or a duplicate row used to disappear into a
 * `.catch(() => undefined)` and the screen simply did not change — which
 * reads as "the button is broken". Now every failure raises a toast with the
 * actual reason, unless the caller opts out with `silent` (inline forms that
 * already render the field error) or the error is a validation error (those
 * are highlighted on the field itself).
 */
export function useMutation<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  options: {
    onSuccess?: (result: R, ...args: A) => void;
    onError?: (error: ApiError) => void;
    /** Skip the automatic failure toast (the caller shows its own). */
    silent?: boolean;
  } = {},
) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const mutate = useCallback(
    async (...args: A) => {
      setPending(true);
      setError(null);
      setSuccess(false);
      try {
        const result = await fn(...args);
        if (!mounted.current) return result;
        setSuccess(true);
        options.onSuccess?.(result, ...args);
        return result;
      } catch (err) {
        const apiError = err as ApiError;
        if (!mounted.current) throw apiError;
        setError(apiError?.message ?? 'Something went wrong. Please try again.');
        if (!options.silent && apiError?.code !== 'validation' && apiError?.code !== 'not_found') {
          toast.error('That did not save', apiError?.message ?? 'Something went wrong. Please try again.');
        }
        options.onError?.(apiError);
        throw apiError;
      } finally {
        if (mounted.current) setPending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, options.silent],
  );

  return { mutate, pending, error, success, reset: () => { setError(null); setSuccess(false); } };
}
