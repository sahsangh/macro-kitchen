import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { get } from './api';

/** GET `path` whenever the screen gains focus (or `path` changes). */
export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(path);
  useEffect(() => {
    latest.current = path;
  }, [path]);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      const result = await get<T>(path);
      if (latest.current === path) {
        setData(result);
        setError(null);
      }
    } catch (e: any) {
      if (latest.current === path) setError(e.message);
    } finally {
      if (latest.current === path) setLoading(false);
    }
  }, [path]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, error, loading, reload, setData };
}
