import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Alert,
  AlertFilters,
  AlertsSummary,
  TopSignature,
} from '../types/alerts';
import {
  fetchAlerts,
  fetchAlertsSummary,
  fetchTopSignatures,
} from '../api/alerts';

const PAGE_SIZE = 200;
const POLL_MS = 5000;

interface AlertsData {
  alerts: Alert[];
  summary: AlertsSummary | null;
  topSignatures: TopSignature[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  paused: boolean;
  lastUpdated: Date | null;
  refresh: () => void;
  loadMore: () => void;
  setPaused: (v: boolean) => void;
}

export function useAlertsData(filters: AlertFilters): AlertsData {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertsSummary | null>(null);
  const [topSignatures, setTopSignatures] = useState<TopSignature[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const offsetRef = useRef(0);
  const isLoadingRef = useRef(false);

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      if (showSpinner) setLoading(true);
      setError(null);
      offsetRef.current = 0;
      try {
        const [page, sum, top] = await Promise.all([
          fetchAlerts(filters, 0, PAGE_SIZE),
          fetchAlertsSummary(filters),
          fetchTopSignatures(filters, 10),
        ]);
        setAlerts(page.alerts);
        setTotal(page.total);
        setHasMore(page.alerts.length >= PAGE_SIZE && page.alerts.length < page.total);
        setSummary(sum);
        setTopSignatures(top);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load alerts');
      } finally {
        if (showSpinner) setLoading(false);
        isLoadingRef.current = false;
      }
    },
    [filters.start, filters.stop, filters.severity, filters.src_ip, filters.dest_ip, filters.signature, filters.q],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      load(false);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [paused, load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextOffset = offsetRef.current + PAGE_SIZE;
    try {
      const res = await fetchAlerts(filters, nextOffset, PAGE_SIZE);
      offsetRef.current = nextOffset;
      setAlerts((prev) => [...prev, ...res.alerts]);
      setHasMore(
        res.alerts.length >= PAGE_SIZE &&
          nextOffset + res.alerts.length < res.total,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more alerts');
    } finally {
      setLoadingMore(false);
    }
  }, [filters, loadingMore, hasMore]);

  return {
    alerts,
    summary,
    topSignatures,
    total,
    loading,
    loadingMore,
    hasMore,
    error,
    paused,
    lastUpdated,
    refresh: () => load(true),
    loadMore,
    setPaused,
  };
}
