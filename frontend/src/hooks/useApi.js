/**
 * useApi — A lightweight client-side cache + fetch hook.
 * 
 * Features:
 *  - Deduplicates concurrent requests for the same key.
 *  - Stale-while-revalidate: returns cached data immediately, refetches in background.
 *  - Configurable TTL (default 30s).
 *  - Manual refresh via returned `refresh()`.
 *  - Avoids setState on unmounted components.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const cache = new Map(); // key → { data, timestamp, promise }

function isFresh(entry, ttlMs) {
  return entry && Date.now() - entry.timestamp < ttlMs;
}

export function clearCache(keyPrefix) {
  if (keyPrefix) {
    for (const k of cache.keys()) {
      if (k.startsWith(keyPrefix)) cache.delete(k);
    }
  } else {
    cache.clear();
  }
}

/**
 * @param {string|null} cacheKey  — unique key; null/undefined skips fetching
 * @param {() => Promise<any>} fetcher — async function that returns data
 * @param {{ ttlMs?: number, skip?: boolean, onSuccess?: fn, onError?: fn }} options
 */
export function useApi(cacheKey, fetcher, { ttlMs = 30_000, skip = false, onSuccess, onError } = {}) {
  const [state, setState] = useState(() => {
    const cached = cacheKey ? cache.get(cacheKey) : null;
    return {
      data: cached?.data ?? null,
      loading: !cached,
      error: null,
    };
  });

  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  fetcherRef.current = fetcher;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const execute = useCallback(async (key, force = false) => {
    if (!key || skip) return;

    const existing = cache.get(key);
    if (!force && isFresh(existing, ttlMs)) {
      if (mounted.current) {
        setState({ data: existing.data, loading: false, error: null });
      }
      return;
    }

    // Stale-while-revalidate: show stale data instantly
    if (existing?.data && mounted.current) {
      setState({ data: existing.data, loading: true, error: null });
    } else if (mounted.current) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }

    // Deduplicate in-flight requests
    if (existing?.promise) {
      try {
        const data = await existing.promise;
        if (mounted.current) setState({ data, loading: false, error: null });
      } catch (err) {
        if (mounted.current) setState((prev) => ({ ...prev, loading: false, error: err }));
        onErrorRef.current?.(err);
      }
      return;
    }

    const promise = fetcherRef.current();
    cache.set(key, { data: existing?.data ?? null, timestamp: existing?.timestamp ?? 0, promise });

    try {
      const data = await promise;
      cache.set(key, { data, timestamp: Date.now(), promise: null });
      if (mounted.current) setState({ data, loading: false, error: null });
      onSuccessRef.current?.(data);
    } catch (err) {
      cache.set(key, { data: existing?.data ?? null, timestamp: existing?.timestamp ?? 0, promise: null });
      if (mounted.current) setState((prev) => ({ ...prev, loading: false, error: err }));
      onErrorRef.current?.(err);
    }
  }, [cacheKey, ttlMs, skip]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mounted.current = true;
    execute(cacheKey);
    return () => { mounted.current = false; };
  }, [cacheKey, skip]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => execute(cacheKey, true), [cacheKey, execute]);

  return { ...state, refresh };
}
