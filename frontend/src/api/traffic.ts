import type {
  TrafficSummaryResponse,
  TopEndpointsResponse,
  ProtocolDistributionResponse,
  ProtocolOption,
  TrafficFilters,
  FlowsResponse,
} from '../types/traffic';
import apiClient from './client';

function buildParams(filters: TrafficFilters, extra?: Record<string, string | number>) {
  const params: Record<string, string | number> = {
    start: filters.start,
    stop: filters.stop,
  };
  if (filters.proto) params.proto = filters.proto;
  if (filters.src_ip) params.src_ip = filters.src_ip;
  if (filters.dst_ip) params.dst_ip = filters.dst_ip;
  return { ...params, ...extra };
}

export async function fetchTrafficSummary(filters: TrafficFilters): Promise<TrafficSummaryResponse> {
  const { data } = await apiClient.get<TrafficSummaryResponse>('/traffic/summary', {
    params: buildParams(filters),
  });
  return data;
}

export async function fetchTopSources(filters: TrafficFilters, limit = 10): Promise<TopEndpointsResponse> {
  const { data } = await apiClient.get<TopEndpointsResponse>('/traffic/top-sources', {
    params: buildParams(filters, { limit }),
  });
  return data;
}

export async function fetchTopDestinations(filters: TrafficFilters, limit = 10): Promise<TopEndpointsResponse> {
  const { data } = await apiClient.get<TopEndpointsResponse>('/traffic/top-destinations', {
    params: buildParams(filters, { limit }),
  });
  return data;
}

export async function fetchProtocolDistribution(filters: TrafficFilters): Promise<ProtocolDistributionResponse> {
  const { data } = await apiClient.get<ProtocolDistributionResponse>('/traffic/protocol-distribution', {
    params: buildParams(filters),
  });
  return data;
}

export async function fetchProtocols(): Promise<ProtocolOption[]> {
  const { data } = await apiClient.get<ProtocolOption[]>('/traffic/protocols');
  return data;
}

export async function fetchFlows(
  filters: TrafficFilters,
  offset = 0,
  limit = 200,
): Promise<FlowsResponse> {
  const { data } = await apiClient.get<FlowsResponse>('/traffic/flows', {
    params: buildParams(filters, { offset, limit }),
  });
  return data;
}
