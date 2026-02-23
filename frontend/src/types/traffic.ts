export interface TrafficPoint {
  time: string;
  bytes_sum: number;
  packets_sum: number;
  flows_count: number;
  proto: string | null;
}

export interface TrafficSummaryResponse {
  start: string;
  stop: string;
  total_bytes: number;
  total_packets: number;
  total_flows: number;
  points: TrafficPoint[];
}

export interface TopEndpoint {
  ip: string;
  bytes_sum: number;
  packets_sum: number;
  flows_count: number;
}

export interface TopEndpointsResponse {
  start: string;
  stop: string;
  endpoints: TopEndpoint[];
}

export interface ProtocolBucket {
  proto: string;
  label: string;
  bytes_sum: number;
  packets_sum: number;
  flows_count: number;
}

export interface ProtocolDistributionResponse {
  start: string;
  stop: string;
  protocols: ProtocolBucket[];
}

export interface TrafficFilters {
  start: string;
  stop: string;
  proto?: string;
  src_ip?: string;
  dst_ip?: string;
}
