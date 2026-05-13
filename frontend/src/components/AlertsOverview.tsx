import { useEffect, useState } from 'react';
import type {
  Alert,
  AlertFilters,
  AlertsSummary,
  TopSignature,
} from '../types/alerts';
import {
  fetchAlerts,
  fetchAlertsSummary,
  fetchTopSignatures,
} from '../api/alerts';
import SeverityBadge from './SeverityBadge';
import AlertDetailModal from './AlertDetailModal';

const POLL_MS = 5000;

function last24h(): AlertFilters {
  const stop = new Date();
  const start = new Date(stop.getTime() - 24 * 3600_000);
  return { start: start.toISOString(), stop: stop.toISOString() };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function AlertsOverview() {
  const [summary, setSummary] = useState<AlertsSummary | null>(null);
  const [topSig, setTopSig] = useState<TopSignature | null>(null);
  const [latest, setLatest] = useState<Alert | null>(null);
  const [topAttacker, setTopAttacker] = useState<{ ip: string; count: number } | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const filters = last24h();
      try {
        const [sum, sigs, latestPage, attackerSample] = await Promise.all([
          fetchAlertsSummary(filters),
          fetchTopSignatures(filters, 1),
          fetchAlerts(filters, 0, 1),
          fetchAlerts(filters, 0, 500),
        ]);

        if (cancelled) return;

        setSummary(sum);
        const firstSig = Array.isArray(sigs) ? sigs[0] : null;
        setTopSig(firstSig && typeof firstSig === 'object' ? firstSig : null);
        const firstAlert = latestPage?.alerts?.[0];
        setLatest(firstAlert && typeof firstAlert === 'object' ? firstAlert : null);

        const counts = new Map<string, number>();
        const sample = Array.isArray(attackerSample?.alerts) ? attackerSample.alerts : [];
        for (const a of sample) {
          if (!a?.src_ip) continue;
          counts.set(a.src_ip, (counts.get(a.src_ip) ?? 0) + 1);
        }
        let bestIp: string | null = null;
        let bestCount = 0;
        for (const [ip, c] of counts) {
          if (c > bestCount) {
            bestCount = c;
            bestIp = ip;
          }
        }
        setTopAttacker(bestIp ? { ip: bestIp, count: bestCount } : null);
      } catch {
        // intentionally silent: dashboard widget shouldn't crash the page
      }
    };

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <>
      <div className="panel alerts-overview">
        <h2 className="panel-title">IDS Alerts · Last 24h</h2>
        <div className="alerts-overview-grid">
          <div className="overview-card overview-card--critical">
            <span className="overview-label">Critical</span>
            <span className="overview-value">{summary?.critical ?? 0}</span>
          </div>
          <div className="overview-card overview-card--total">
            <span className="overview-label">Total alerts</span>
            <span className="overview-value">{summary?.total ?? 0}</span>
          </div>
          <div className="overview-card">
            <span className="overview-label">Latest attack</span>
            {latest && typeof latest === 'object' && latest.timestamp ? (
              <button
                className="overview-link"
                onClick={() => setSelectedAlertId(latest.id)}
              >
                <span className="overview-sub">
                  <SeverityBadge severity={latest.severity} />
                  <span className="overview-time">{formatTime(latest.timestamp)}</span>
                </span>
                <span className="overview-signature">
                  {latest.signature ?? 'Unknown signature'}
                </span>
              </button>
            ) : (
              <span className="overview-value overview-empty">None</span>
            )}
          </div>
          <div className="overview-card">
            <span className="overview-label">Top attacker IP</span>
            {topAttacker ? (
              <>
                <span className="overview-value ip-cell">{topAttacker.ip}</span>
                <span className="overview-sub">{topAttacker.count} hits</span>
              </>
            ) : (
              <span className="overview-value overview-empty">—</span>
            )}
          </div>
          <div className="overview-card">
            <span className="overview-label">Most common signature</span>
            {topSig && typeof topSig === 'object' && topSig.signature ? (
              <>
                <span className="overview-signature">{topSig.signature}</span>
                <span className="overview-sub">
                  <SeverityBadge severity={topSig.severity} />
                  <span>{(topSig.count ?? 0).toLocaleString()} hits</span>
                </span>
              </>
            ) : (
              <span className="overview-value overview-empty">—</span>
            )}
          </div>
        </div>
      </div>

      <AlertDetailModal
        alertId={selectedAlertId}
        onClose={() => setSelectedAlertId(null)}
      />
    </>
  );
}
