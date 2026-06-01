import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  FirewallAuditEntry,
  FirewallRule,
  FirewallSettings,
  FirewallSettingsUpdate,
  TrustedIp,
} from '../types/firewall';
import {
  blockIp,
  fetchAudit,
  fetchGatewayStatus,
  fetchRules,
  fetchSettings,
  fetchTrustedIps,
  unblockRule,
  updateSettings,
} from '../api/firewall';

const POLL_MS = 5000;

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatExpires(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return `${formatTime(iso)} (expired)`;
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `${formatTime(iso)} (in ${mins}m)`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${formatTime(iso)} (in ${hrs}h${remMins}m)`;
}

function getApiErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as {
      response?: { data?: { detail?: string } };
      message?: string;
    };
    if (e.response?.data?.detail) return e.response.data.detail;
    if (e.message) return e.message;
  }
  return 'Request failed';
}

function StatusPill({ status }: { status: string }) {
  const className = `status-pill status-${status.toLowerCase()}`;
  return <span className={className}>{status}</span>;
}

function SourcePill({ source }: { source: string }) {
  const className = `source-pill source-${source.toLowerCase()}`;
  return <span className={className}>{source}</span>;
}

interface ManualBlockForm {
  ip: string;
  duration: number;
  reason: string;
}

const DEFAULT_BLOCK_FORM: ManualBlockForm = {
  ip: '',
  duration: 30,
  reason: '',
};

const DURATION_PRESETS: { label: string; minutes: number }[] = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '6h', minutes: 360 },
  { label: '24h', minutes: 1440 },
];

export default function AccessRules() {
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [settings, setSettings] = useState<FirewallSettings | null>(null);
  const [audit, setAudit] = useState<FirewallAuditEntry[]>([]);
  const [trustedIps, setTrustedIps] = useState<TrustedIp[]>([]);
  const [gatewayReachable, setGatewayReachable] = useState<boolean | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [blockForm, setBlockForm] = useState<ManualBlockForm>(DEFAULT_BLOCK_FORM);
  const [submittingBlock, setSubmittingBlock] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<FirewallSettings | null>(
    null,
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const loadAll = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      try {
        const [rulesRes, settingsRes, auditRes, trustedRes, gwRes] =
          await Promise.all([
            fetchRules(),
            fetchSettings(),
            fetchAudit(200),
            fetchTrustedIps(),
            fetchGatewayStatus().catch(() => ({ reachable: false })),
          ]);
        setRules(rulesRes.rules);
        setSettings(settingsRes);
        setSettingsDraft((prev) => prev ?? settingsRes);
        setAudit(auditRes.entries);
        setTrustedIps(trustedRes.trusted_ips);
        setGatewayReachable(gwRes.reachable);
        setError(null);
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadAll(true);
  }, [loadAll]);

  useEffect(() => {
    const id = setInterval(() => loadAll(false), POLL_MS);
    return () => clearInterval(id);
  }, [loadAll]);

  const activeRules = useMemo(
    () => rules.filter((r) => r.status === 'ACTIVE'),
    [rules],
  );
  const historyRules = useMemo(
    () => rules.filter((r) => r.status !== 'ACTIVE'),
    [rules],
  );
  const trustedSet = useMemo(
    () => new Set(trustedIps.map((t) => t.ip_address)),
    [trustedIps],
  );

  const summaryCards = [
    {
      label: 'Active Rules',
      value: activeRules.length.toLocaleString(),
      accent: 'var(--accent-red)',
    },
    {
      label: 'Auto Blocking',
      value: settings?.auto_block_enabled ? 'ENABLED' : 'DISABLED',
      accent: settings?.auto_block_enabled
        ? 'var(--accent-green)'
        : 'var(--text-secondary)',
    },
    {
      label: 'Threshold',
      value: settings
        ? `${settings.alert_threshold} / ${settings.time_window_minutes}m`
        : '—',
      accent: 'var(--accent-orange)',
    },
    {
      label: 'Block Duration',
      value: settings ? `${settings.block_duration_minutes}m` : '—',
      accent: 'var(--accent)',
    },
  ];

  const handleBlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);

    const ip = blockForm.ip.trim();
    if (!ip) {
      setError('IP address is required.');
      return;
    }
    if (trustedSet.has(ip)) {
      setError(`${ip} is a trusted IP and cannot be blocked.`);
      return;
    }

    setSubmittingBlock(true);
    try {
      const rule = await blockIp({
        ip_address: ip,
        duration_minutes: blockForm.duration,
        reason: blockForm.reason.trim() || undefined,
      });
      setInfo(`Blocked ${rule.ip_address} until ${formatTime(rule.expires_at)}.`);
      setBlockForm(DEFAULT_BLOCK_FORM);
      await loadAll(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmittingBlock(false);
    }
  };

  const handleUnblock = async (rule: FirewallRule) => {
    if (!window.confirm(`Unblock ${rule.ip_address}?`)) return;
    setError(null);
    setInfo(null);
    setRemovingId(rule.id);
    try {
      await unblockRule(rule.id);
      setInfo(`Unblocked ${rule.ip_address}.`);
      await loadAll(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setRemovingId(null);
    }
  };

  const handleSettingsSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!settingsDraft) return;
    setError(null);
    setInfo(null);
    setSavingSettings(true);
    try {
      const payload: FirewallSettingsUpdate = {
        auto_block_enabled: settingsDraft.auto_block_enabled,
        alert_threshold: settingsDraft.alert_threshold,
        time_window_minutes: settingsDraft.time_window_minutes,
        block_duration_minutes: settingsDraft.block_duration_minutes,
      };
      const saved = await updateSettings(payload);
      setSettings(saved);
      setSettingsDraft(saved);
      setInfo('Settings saved.');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSavingSettings(false);
    }
  };

  const updateDraft = <K extends keyof FirewallSettings>(
    key: K,
    value: FirewallSettings[K],
  ) => {
    setSettingsDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  return (
    <main className="flows-page access-rules-page">
      <header className="filters-bar">
        <div className="filter-group">
          <label>Access Rules</label>
          <div className="gateway-status">
            <span
              className={`gateway-dot${gatewayReachable === false ? ' gateway-dot--down' : ''}`}
            />
            <span className="gateway-text">
              Gateway agent:{' '}
              {gatewayReachable === null
                ? 'checking…'
                : gatewayReachable
                  ? 'reachable'
                  : 'unreachable'}
            </span>
          </div>
        </div>
        <div className="filter-actions">
          <button
            className="refresh-btn"
            onClick={() => loadAll(true)}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {info && <div className="info-banner">{info}</div>}

      <div className="stat-cards">
        {summaryCards.map((c) => (
          <div
            key={c.label}
            className="stat-card"
            style={{ borderTopColor: c.accent }}
          >
            <span className="stat-value">{c.value}</span>
            <span className="stat-label">{c.label}</span>
          </div>
        ))}
      </div>

      <div className="access-grid">
        <form className="panel" onSubmit={handleBlock}>
          <h2 className="panel-title">Manual Block</h2>
          <div className="form-grid">
            <label className="form-field">
              <span>IP Address</span>
              <input
                type="text"
                placeholder="e.g. 192.168.100.10"
                value={blockForm.ip}
                onChange={(e) =>
                  setBlockForm({ ...blockForm, ip: e.target.value })
                }
                required
              />
              {blockForm.ip && trustedSet.has(blockForm.ip.trim()) && (
                <span className="form-warning">
                  This IP is trusted and cannot be blocked.
                </span>
              )}
            </label>

            <label className="form-field">
              <span>Duration (minutes)</span>
              <input
                type="number"
                min={1}
                max={10080}
                value={blockForm.duration}
                onChange={(e) =>
                  setBlockForm({
                    ...blockForm,
                    duration: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
              <div className="duration-presets">
                {DURATION_PRESETS.map((p) => (
                  <button
                    type="button"
                    key={p.label}
                    className={`preset-btn${blockForm.duration === p.minutes ? ' preset-btn--active' : ''}`}
                    onClick={() =>
                      setBlockForm({ ...blockForm, duration: p.minutes })
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </label>

            <label className="form-field form-field--full">
              <span>Reason / Comment</span>
              <input
                type="text"
                placeholder="optional"
                value={blockForm.reason}
                onChange={(e) =>
                  setBlockForm({ ...blockForm, reason: e.target.value })
                }
              />
            </label>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="block-btn"
              disabled={
                submittingBlock ||
                !blockForm.ip.trim() ||
                trustedSet.has(blockForm.ip.trim())
              }
            >
              {submittingBlock ? 'Blocking…' : 'Block IP'}
            </button>
          </div>
        </form>

        <form className="panel" onSubmit={handleSettingsSave}>
          <h2 className="panel-title">Automatic Block Settings</h2>
          {settingsDraft ? (
            <>
              <div className="form-grid">
                <label className="form-field form-field--toggle">
                  <span>Enable automatic blocking</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={settingsDraft.auto_block_enabled}
                      onChange={(e) =>
                        updateDraft('auto_block_enabled', e.target.checked)
                      }
                    />
                    <span className="switch-slider" />
                  </label>
                </label>

                <label className="form-field">
                  <span>Alert threshold (hits)</span>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={settingsDraft.alert_threshold}
                    onChange={(e) =>
                      updateDraft(
                        'alert_threshold',
                        Math.max(1, Number(e.target.value) || 1),
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>Time window (minutes)</span>
                  <input
                    type="number"
                    min={1}
                    max={10080}
                    value={settingsDraft.time_window_minutes}
                    onChange={(e) =>
                      updateDraft(
                        'time_window_minutes',
                        Math.max(1, Number(e.target.value) || 1),
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>Block duration (minutes)</span>
                  <input
                    type="number"
                    min={1}
                    max={10080}
                    value={settingsDraft.block_duration_minutes}
                    onChange={(e) =>
                      updateDraft(
                        'block_duration_minutes',
                        Math.max(1, Number(e.target.value) || 1),
                      )
                    }
                  />
                </label>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="save-btn"
                  disabled={savingSettings}
                >
                  {savingSettings ? 'Saving…' : 'Save Settings'}
                </button>
                <span className="settings-meta">
                  Updated: {formatTime(settings?.updated_at ?? null)}
                </span>
              </div>
            </>
          ) : (
            <div className="empty-row">Loading settings…</div>
          )}
        </form>
      </div>

      <div className="panel">
        <h2 className="panel-title">
          Active Rules ({activeRules.length.toLocaleString()})
        </h2>
        <div className="access-table-wrap">
          <table className="access-table access-table--active">
            <thead>
              <tr>
                <th>#</th>
                <th>IP</th>
                <th>Action</th>
                <th>Source</th>
                <th>Reason</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && activeRules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-row">
                    Loading…
                  </td>
                </tr>
              ) : activeRules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-row">
                    No active rules.
                  </td>
                </tr>
              ) : (
                activeRules.map((r, i) => (
                  <tr key={r.id}>
                    <td className="row-num">{i + 1}</td>
                    <td className="ip-cell">{r.ip_address}</td>
                    <td>{r.action}</td>
                    <td>
                      <SourcePill source={r.source} />
                    </td>
                    <td className="reason-cell">{r.reason ?? '—'}</td>
                    <td className="time-cell">{formatTime(r.created_at)}</td>
                    <td className="time-cell">{formatExpires(r.expires_at)}</td>
                    <td>
                      <StatusPill status={r.status} />
                    </td>
                    <td>
                      <button
                        className="unblock-btn"
                        onClick={() => handleUnblock(r)}
                        disabled={removingId === r.id}
                      >
                        {removingId === r.id ? '…' : 'Unblock'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="access-grid access-grid--bottom">
        <div className="panel">
          <h2 className="panel-title">
            Rule History ({historyRules.length.toLocaleString()})
          </h2>
          <div className="access-table-wrap">
            <table className="access-table access-table--history">
              <thead>
                <tr>
                  <th>IP</th>
                  <th>Source</th>
                  <th>Reason</th>
                  <th>Created</th>
                  <th>Ended</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {historyRules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      No history yet.
                    </td>
                  </tr>
                ) : (
                  historyRules.slice(0, 50).map((r) => (
                    <tr key={r.id}>
                      <td className="ip-cell">{r.ip_address}</td>
                      <td>
                        <SourcePill source={r.source} />
                      </td>
                      <td className="reason-cell">{r.reason ?? '—'}</td>
                      <td className="time-cell">{formatTime(r.created_at)}</td>
                      <td className="time-cell">
                        {formatTime(r.removed_at ?? r.expires_at)}
                      </td>
                      <td>
                        <StatusPill status={r.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2 className="panel-title">Audit Log</h2>
          <div className="access-table-wrap">
            <table className="access-table access-table--audit">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>IP</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {audit.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-row">
                      No audit entries.
                    </td>
                  </tr>
                ) : (
                  audit.slice(0, 50).map((e) => (
                    <tr key={e.id}>
                      <td className="time-cell">{formatTime(e.created_at)}</td>
                      <td className="ip-cell">{e.ip_address ?? '—'}</td>
                      <td>{e.action ?? '—'}</td>
                      <td>
                        {e.status ? <StatusPill status={e.status} /> : '—'}
                      </td>
                      <td className="reason-cell">{e.message ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Trusted IPs (never blocked)</h2>
        <div className="trusted-list">
          {trustedIps.map((t) => (
            <div key={t.ip_address} className="trusted-chip">
              <span className="ip-cell">{t.ip_address}</span>
              {t.description && (
                <span className="trusted-desc">{t.description}</span>
              )}
            </div>
          ))}
          {trustedIps.length === 0 && (
            <span className="empty-row">No trusted IPs configured.</span>
          )}
        </div>
      </div>
    </main>
  );
}
