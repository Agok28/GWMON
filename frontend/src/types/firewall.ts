export type RuleStatus = 'ACTIVE' | 'EXPIRED' | 'REMOVED' | 'FAILED' | 'PENDING';
export type RuleSource = 'MANUAL' | 'AUTOMATIC';
export type RuleAction = 'BLOCK' | 'UNBLOCK';

export interface FirewallRule {
  id: number;
  ip_address: string;
  action: string;
  source: string;
  reason: string | null;
  status: string;
  created_at: string;
  expires_at: string | null;
  removed_at: string | null;
  created_by: string | null;
}

export interface FirewallRulesResponse {
  rules: FirewallRule[];
}

export interface FirewallSettings {
  auto_block_enabled: boolean;
  alert_threshold: number;
  time_window_minutes: number;
  block_duration_minutes: number;
  updated_at: string | null;
}

export type FirewallSettingsUpdate = Partial<Omit<FirewallSettings, 'updated_at'>>;

export interface ManualBlockRequest {
  ip_address: string;
  duration_minutes: number;
  reason?: string;
}

export interface FirewallAuditEntry {
  id: number;
  created_at: string;
  ip_address: string | null;
  action: string | null;
  status: string | null;
  source: string | null;
  rule_id: number | null;
  message: string | null;
  actor: string | null;
}

export interface FirewallAuditResponse {
  entries: FirewallAuditEntry[];
}

export interface TrustedIp {
  ip_address: string;
  description: string | null;
  created_at: string;
}

export interface TrustedIpsResponse {
  trusted_ips: TrustedIp[];
}
