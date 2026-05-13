import { useEffect, useState } from 'react';
import type { TrafficFilters, ProtocolOption } from '../types/traffic';
import { useTrafficData } from '../hooks/useTrafficData';
import { fetchProtocols } from '../api/traffic';
import {
  fetchAlerts,
  fetchAlertsSummary,
  fetchTopSignatures,
} from '../api/alerts';
import { exportDashboardPdf } from '../utils/exportPdf';
import type { TopAttacker } from '../utils/exportPdf';
import Filters from '../components/Filters';
import StatCards from '../components/StatCards';
import TrafficChart from '../components/TrafficChart';
import ProtocolPieChart from '../components/ProtocolPieChart';
import TopEndpointsTable from '../components/TopEndpointsTable';
import AlertsOverview from '../components/AlertsOverview';

function defaultFilters(): TrafficFilters {
  const stop = new Date();
  const start = new Date(stop.getTime() - 30 * 24 * 3600_000);
  return { start: start.toISOString(), stop: stop.toISOString() };
}

export default function Dashboard() {
  const [filters, setFilters] = useState<TrafficFilters>(defaultFilters);
  const [protocols, setProtocols] = useState<ProtocolOption[]>([]);
  const { summary, topSources, topDestinations, protocolDist, loading, error, refresh } =
    useTrafficData(filters);

  useEffect(() => {
    fetchProtocols()
      .then(setProtocols)
      .catch(() => setProtocols([]));
  }, []);

  const handleExportPdf = async () => {
    const alertFilters = { start: filters.start, stop: filters.stop };
    try {
      const [alertsSummary, topSigs, latestPage, attackerSample] = await Promise.all([
        fetchAlertsSummary(alertFilters),
        fetchTopSignatures(alertFilters, 10),
        fetchAlerts(alertFilters, 0, 1),
        fetchAlerts(alertFilters, 0, 500),
      ]);

      const counts = new Map<string, number>();
      for (const a of attackerSample.alerts) {
        if (!a.src_ip) continue;
        counts.set(a.src_ip, (counts.get(a.src_ip) ?? 0) + 1);
      }
      let topAttacker: TopAttacker | null = null;
      for (const [ip, c] of counts) {
        if (!topAttacker || c > topAttacker.count) {
          topAttacker = { ip, count: c };
        }
      }

      exportDashboardPdf({
        filters,
        summary,
        topSources,
        topDestinations,
        protocolDist,
        protocols,
        alertsSummary,
        topSignatures: topSigs,
        latestAlert: latestPage.alerts[0] ?? null,
        topAttacker,
        alertsAvailable: true,
      });
    } catch {
      exportDashboardPdf({
        filters,
        summary,
        topSources,
        topDestinations,
        protocolDist,
        protocols,
        alertsAvailable: false,
      });
    }
  };

  return (
    <main className="dashboard">
      <Filters
        filters={filters}
        protocols={protocols}
        onChange={setFilters}
        onRefresh={refresh}
        onExportPdf={handleExportPdf}
        loading={loading}
      />

      {error && <div className="error-banner">{error}</div>}

      {loading && !summary ? (
        <div className="loading-state">Loading dashboard data…</div>
      ) : (
        <>
          <StatCards
            totalBytes={summary?.total_bytes ?? 0}
            totalPackets={summary?.total_packets ?? 0}
            totalFlows={summary?.total_flows ?? 0}
          />

          <AlertsOverview />

          <div className="charts-row">
            <TrafficChart
              points={summary?.points ?? []}
              start={filters.start}
              stop={filters.stop}
            />
            <ProtocolPieChart protocols={protocolDist?.protocols ?? []} />
          </div>

          <div className="tables-row">
            <TopEndpointsTable title="Top Sources" endpoints={topSources?.endpoints ?? []} />
            <TopEndpointsTable
              title="Top Destinations"
              endpoints={topDestinations?.endpoints ?? []}
            />
          </div>
        </>
      )}
    </main>
  );
}
