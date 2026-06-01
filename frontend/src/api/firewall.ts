import type {
  FirewallAuditResponse,
  FirewallRule,
  FirewallRulesResponse,
  FirewallSettings,
  FirewallSettingsUpdate,
  ManualBlockRequest,
  TrustedIpsResponse,
} from '../types/firewall';
import apiClient from './client';

export async function fetchRules(status?: string): Promise<FirewallRulesResponse> {
  const params: Record<string, string | number> = {};
  if (status) params.status = status;
  const { data } = await apiClient.get<FirewallRulesResponse>('/firewall/rules', {
    params,
  });
  return data;
}

export async function blockIp(req: ManualBlockRequest): Promise<FirewallRule> {
  const { data } = await apiClient.post<FirewallRule>('/firewall/block', req);
  return data;
}

export async function unblockRule(ruleId: number): Promise<FirewallRule> {
  const { data } = await apiClient.post<FirewallRule>(
    `/firewall/unblock/${ruleId}`,
  );
  return data;
}

export async function fetchSettings(): Promise<FirewallSettings> {
  const { data } = await apiClient.get<FirewallSettings>('/firewall/settings');
  return data;
}

export async function updateSettings(
  payload: FirewallSettingsUpdate,
): Promise<FirewallSettings> {
  const { data } = await apiClient.put<FirewallSettings>(
    '/firewall/settings',
    payload,
  );
  return data;
}

export async function fetchAudit(limit = 200): Promise<FirewallAuditResponse> {
  const { data } = await apiClient.get<FirewallAuditResponse>('/firewall/audit', {
    params: { limit },
  });
  return data;
}

export async function fetchTrustedIps(): Promise<TrustedIpsResponse> {
  const { data } = await apiClient.get<TrustedIpsResponse>(
    '/firewall/trusted-ips',
  );
  return data;
}

export async function fetchGatewayStatus(): Promise<{ reachable: boolean }> {
  const { data } = await apiClient.get<{ reachable: boolean }>(
    '/firewall/gateway-status',
  );
  return data;
}
