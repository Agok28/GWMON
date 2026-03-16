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

export interface ProtocolOption {
  proto: string;
  label: string;
}

export interface TrafficFilters {
  start: string;
  stop: string;
  proto?: string;
  src_ip?: string;
  dst_ip?: string;
  src_port?: number;
  dst_port?: number;
}

export interface FlowRecord {
  time: string;
  src_ip: string;
  src_port: number;
  dst_ip: string;
  dst_port: number;
  proto: string;
  proto_label: string;
  bytes: number;
  packets: number;
  direction: 'inbound' | 'outbound' | 'internal' | 'external';
}

export interface FlowsResponse {
  start: string;
  stop: string;
  offset: number;
  limit: number;
  flows: FlowRecord[];
}
