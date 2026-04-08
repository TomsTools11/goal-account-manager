import { useState, useEffect, useCallback, useMemo } from 'react';

export function useApi(urlOrFn, options = {}) {
  const { autoFetch = true, deps = [] } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Resolve URL if it's a function
  const url = useMemo(() => {
    if (typeof urlOrFn === 'function') {
      try { return urlOrFn(); } catch { return null; }
    }
    return urlOrFn;
  }, [urlOrFn]);

  const fetchData = useCallback(async (overrideUrl) => {
    const targetUrl = overrideUrl || url;
    if (!targetUrl) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(targetUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      return json;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (autoFetch && url) fetchData();
  }, [url, autoFetch, ...deps]);

  return { data, loading, error, refetch: fetchData };
}

export function useApiPost() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const post = useCallback(async (url, body) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { post, loading, error };
}
