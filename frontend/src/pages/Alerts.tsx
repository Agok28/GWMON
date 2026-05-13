import { useMemo, useState } from 'react';
import type { AlertFilters } from '../types/alerts';
import { useAlertsData } from '../hooks/useAlertsData';
import SeverityBadge from '../components/SeverityBadge';
import AlertDetailModal from '../components/AlertDetailModal';

function defaultFilters(): AlertFilters {
  const stop = new Date();
  const start = new Date(stop.getTime() - 24 * 3600_000);
  return { start: start.toISOString(), stop: stop.toISOString() };
}

function formatTime(iso: string): string {
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

function formatRelative(date: Date | null): string {
  if (!date) return '—';
  const diff = Math.max(0, Date.now() - date.getTime());
  if (diff < 1000) return 'just now';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

const PRESETS: { label: string; hours: number }[] = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
];

export default function Alerts() {
  const [filters, setFilters] = useState<AlertFilters>(defaultFilters);
  const [activePreset, setActivePreset] = useState<string | null>('24h');
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);

  const {
    alerts,
    summary,
    topSignatures,
    total,
    loading,
    loadingMore,
    hasMore,
    error,
    paused,
    lastUpdated,
    refresh,
    loadMore,
    setPaused,
  } = useAlertsData(filters);

  const setRange = (hours: number, label: string) => {
    const stop = new Date();
    const start = new Date(stop.getTime() - hours * 3600_000);
    setActivePreset(label);
    setFilters({ ...filters, start: start.toISOString(), stop: stop.toISOString() });
  };

  const summaryCards = useMemo(
    () => [
      { label: 'Total', value: summary?.total ?? 0, accent: '#4fc3f7' },
      { label: 'Critical', value: summary?.critical ?? 0, accent: '#e57373' },
      { label: 'Medium / High', value: summary?.medium ?? 0, accent: '#ffb74d' },
      { label: 'Low', value: summary?.low ?? 0, accent: '#81c784' },
    ],
    [summary],
  );

  return (
    <main className="flows-page">
      <header className="filters-bar">
        <div className="filter-group">
          <label>Time Range</label>
          <div className="preset-btns">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className={`preset-btn${activePreset === p.label ? ' preset-btn--active' : ''}`}
                onClick={() => setRange(p.hours, p.label)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label>Severity</label>
          <select
            value={filters.severity ?? ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                severity: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          >
            <option value="">All</option>
            <option value="1">Critical (1)</option>
            <option value="2">High (2)</option>
            <option value="3">Medium (3)</option>
            <option value="4">Low (4)</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Source IP</label>
          <input
            type="text"
            placeholder="e.g. 192.168.1.1"
            value={filters.src_ip ?? ''}
            onChange={(e) => setFilters({ ...filters, src_ip: e.target.value || undefined })}
          />
        </div>

        <div className="filter-group">
          <label>Dest IP</label>
          <input
            type="text"
            placeholder="e.g. 10.0.0.1"
            value={filters.dest_ip ?? ''}
            onChange={(e) => setFilters({ ...filters, dest_ip: e.target.value || undefined })}
          />
        </div>

        <div className="filter-group">
          <label>Signature</label>
          <input
            type="text"
            placeholder="search…"
            value={filters.signature ?? ''}
            onChange={(e) => setFilters({ ...filters, signature: e.target.value || undefined })}
          />
        </div>

        <div className="filter-actions">
          <div className="live-indicator">
            <span className={`live-dot${paused ? ' live-dot--paused' : ''}`} />
            <span className="live-text">
              {paused ? 'Paused' : 'Live'} · updated {formatRelative(lastUpdated)}
            </span>
          </div>
          <button
            className="export-btn"
            onClick={() => setPaused(!paused)}
            disabled={loading}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button className="refresh-btn" onClick={refresh} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="stat-cards">
        {summaryCards.map((c) => (
          <div key={c.label} className="stat-card" style={{ borderTopColor: c.accent }}>
            <span className="stat-value">{c.value.toLocaleString()}</span>
            <span className="stat-label">{c.label}</span>
          </div>
        ))}
      </div>

      <div className="alerts-grid">
        <div className="panel top-sigs-panel">
          <h2 className="panel-title">Top Signatures</h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Signature</th>
                  <th>Sev</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {topSignatures.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-row">
                      No signatures in this range.
                    </td>
                  </tr>
                ) : (
                  topSignatures.map((s, i) => (
                    <tr key={`${s.signature}-${i}`}>
                      <td className="row-num">{i + 1}</td>
                      <td>{s.signature}</td>
                      <td>
                        <SeverityBadge severity={s.severity} />
                      </td>
                      <td>{s.count.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel alerts-panel flows-panel">
          <h2 className="panel-title">
            Alerts ({total.toLocaleString()})
          </h2>
          <div className="flows-table-wrap">
            <table className="flows-table alerts-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Time</th>
                  <th>Severity</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Proto</th>
                  <th>Signature</th>
                </tr>
              </thead>
              <tbody>
                {loading && alerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-row">
                      Loading alerts…
                    </td>
                  </tr>
                ) : alerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-row">
                      No alerts match the current filters.
                    </td>
                  </tr>
                ) : (
                  alerts.map((a, i) => (
                    <tr
                      key={a.id}
                      className="alert-row"
                      onClick={() => setSelectedAlertId(a.id)}
                    >
                      <td className="row-num">{i + 1}</td>
                      <td className="time-cell">{formatTime(a.timestamp)}</td>
                      <td>
                        <SeverityBadge severity={a.severity} />
                      </td>
                      <td className="ip-cell">
                        {a.src_ip ?? '—'}
                        {a.src_port != null && (
                          <span className="port-cell">:{a.src_port}</span>
                        )}
                      </td>
                      <td className="ip-cell">
                        {a.dest_ip ?? '—'}
                        {a.dest_port != null && (
                          <span className="port-cell">:{a.dest_port}</span>
                        )}
                      </td>
                      <td>{a.proto ?? '—'}</td>
                      <td className="sig-cell">{a.signature ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {hasMore && alerts.length > 0 && (
            <div className="load-more-wrap">
              <button
                className="load-more-btn"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      </div>

      <AlertDetailModal
        alertId={selectedAlertId}
        onClose={() => setSelectedAlertId(null)}
      />
    </main>
  );
}
