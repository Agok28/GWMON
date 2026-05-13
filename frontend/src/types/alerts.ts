export interface Alert {
  id: number;
  timestamp: string;
  src_ip: string | null;
  src_port: number | null;
  dest_ip: string | null;
  dest_port: number | null;
  proto: string | null;
  signature: string | null;
  signature_id: number | null;
  category: string | null;
  severity: number | null;
  action: string | null;
  direction: string | null;
}

export interface AlertDetail extends Alert {
  flow_id: number | null;
  in_iface: string | null;
  raw: Record<string, unknown> | null;
}

export interface AlertsResponse {
  offset: number;
  limit: number;
  total: number;
  alerts: Alert[];
}

export interface AlertsSummary {
  total: number;
  critical: number;
  medium: number;
  low: number;
}

export interface TopSignature {
  signature: string;
  count: number;
  severity: number | null;
}

export interface AlertFilters {
  start: string;
  stop: string;
  severity?: number;
  src_ip?: string;
  dest_ip?: string;
  signature?: string;
  q?: string;
}
