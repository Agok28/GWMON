import type {
  AlertDetail,
  AlertFilters,
  AlertsResponse,
  AlertsSummary,
  TopSignature,
} from '../types/alerts';
import apiClient from './client';

function buildParams(filters: AlertFilters, extra?: Record<string, string | number>) {
  const params: Record<string, string | number> = {
    start: filters.start,
    stop: filters.stop,
  };
  if (filters.severity !== undefined) params.severity = filters.severity;
  if (filters.src_ip) params.src_ip = filters.src_ip;
  if (filters.dest_ip) params.dest_ip = filters.dest_ip;
  if (filters.signature) params.signature = filters.signature;
  if (filters.q) params.q = filters.q;
  return { ...params, ...extra };
}

export async function fetchAlerts(
  filters: AlertFilters,
  offset = 0,
  limit = 200,
): Promise<AlertsResponse> {
  const { data } = await apiClient.get<AlertsResponse>('/alerts', {
    params: buildParams(filters, { offset, limit }),
  });
  return data;
}

export async function fetchAlertsSummary(filters: AlertFilters): Promise<AlertsSummary> {
  const { data } = await apiClient.get<AlertsSummary>('/alerts/summary', {
    params: buildParams(filters),
  });
  return data;
}

export async function fetchTopSignatures(
  filters: AlertFilters,
  limit = 10,
): Promise<TopSignature[]> {
  const { data } = await apiClient.get<TopSignature[]>('/alerts/top-signatures', {
    params: buildParams(filters, { limit }),
  });
  return data;
}

export async function fetchAlertById(id: number): Promise<AlertDetail> {
  const { data } = await apiClient.get<AlertDetail>(`/alerts/${id}`);
  return data;
}
