import { useState } from 'react';
import type { TrafficFilters } from '../types/traffic';
import { useTrafficData } from '../hooks/useTrafficData';
import { exportDashboardPdf } from '../utils/exportPdf';
import Filters from '../components/Filters';
import StatCards from '../components/StatCards';
import TrafficChart from '../components/TrafficChart';
import ProtocolPieChart from '../components/ProtocolPieChart';
import TopEndpointsTable from '../components/TopEndpointsTable';

function defaultFilters(): TrafficFilters {
  const stop = new Date();
  const start = new Date(stop.getTime() - 30 * 24 * 3600_000);
  return { start: start.toISOString(), stop: stop.toISOString() };
}

export default function Dashboard() {
  const [filters, setFilters] = useState<TrafficFilters>(defaultFilters);
  const { summary, topSources, topDestinations, protocolDist, loading, error, refresh } =
    useTrafficData(filters);

  const handleExportPdf = () => {
    exportDashboardPdf({ filters, summary, topSources, topDestinations, protocolDist });
  };

  return (
    <main className="dashboard">
      <Filters
        filters={filters}
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
