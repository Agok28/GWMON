import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlowRecord, TrafficFilters } from '../types/traffic';
import { fetchFlows } from '../api/traffic';

const PAGE_SIZE = 200;

interface FlowsData {
  flows: FlowRecord[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  refresh: () => void;
  loadMore: () => void;
}

export function useFlowsData(filters: TrafficFilters): FlowsData {
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    offsetRef.current = 0;
    try {
      const res = await fetchFlows(filters, 0, PAGE_SIZE);
      setFlows(res.flows);
      setHasMore(res.flows.length >= PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flows');
      setFlows([]);
    } finally {
      setLoading(false);
    }
  }, [filters.start, filters.stop, filters.proto, filters.src_ip, filters.dst_ip, filters.src_port, filters.dst_port]);

  useEffect(() => { load(); }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextOffset = offsetRef.current + PAGE_SIZE;
    try {
      const res = await fetchFlows(filters, nextOffset, PAGE_SIZE);
      offsetRef.current = nextOffset;
      setFlows((prev) => [...prev, ...res.flows]);
      setHasMore(res.flows.length >= PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more flows');
    } finally {
      setLoadingMore(false);
    }
  }, [filters, loadingMore, hasMore]);

  return { flows, loading, loadingMore, hasMore, error, refresh: load, loadMore };
}
