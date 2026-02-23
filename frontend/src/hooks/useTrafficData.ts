import { useCallback, useEffect, useState } from 'react';
import type {
  TrafficSummaryResponse,
  TopEndpointsResponse,
  ProtocolDistributionResponse,
  TrafficFilters,
} from '../types/traffic';
import {
  fetchTrafficSummary,
  fetchTopSources,
  fetchTopDestinations,
  fetchProtocolDistribution,
} from '../api/traffic';

interface TrafficData {
  summary: TrafficSummaryResponse | null;
  topSources: TopEndpointsResponse | null;
  topDestinations: TopEndpointsResponse | null;
  protocolDist: ProtocolDistributionResponse | null;
  loading: boolean;
  error: string | null;
}

export function useTrafficData(filters: TrafficFilters): TrafficData & { refresh: () => void } {
  const [summary, setSummary] = useState<TrafficSummaryResponse | null>(null);
  const [topSources, setTopSources] = useState<TopEndpointsResponse | null>(null);
  const [topDestinations, setTopDestinations] = useState<TopEndpointsResponse | null>(null);
  const [protocolDist, setProtocolDist] = useState<ProtocolDistributionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, ts, td, pd] = await Promise.all([
        fetchTrafficSummary(filters),
        fetchTopSources(filters),
        fetchTopDestinations(filters),
        fetchProtocolDistribution(filters),
      ]);
      setSummary(s);
      setTopSources(ts);
      setTopDestinations(td);
      setProtocolDist(pd);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load traffic data');
    } finally {
      setLoading(false);
    }
  }, [filters.start, filters.stop, filters.proto, filters.src_ip, filters.dst_ip]);

  useEffect(() => { load(); }, [load]);

  return { summary, topSources, topDestinations, protocolDist, loading, error, refresh: load };
}
