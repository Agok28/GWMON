import { useEffect, useState } from 'react';
import type { TrafficFilters, ProtocolOption, FlowRecord } from '../types/traffic';
import { useFlowsData } from '../hooks/useFlowsData';
import { fetchProtocols } from '../api/traffic';
import Filters from '../components/Filters';

function defaultFilters(): TrafficFilters {
  const stop = new Date();
  const start = new Date(stop.getTime() - 24 * 3600_000);
  return { start: start.toISOString(), stop: stop.toISOString() };
}

function formatBytes(b: number): string {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`;
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
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

const DIRECTION_CONFIG: Record<string, { label: string; className: string }> = {
  inbound: { label: '← IN', className: 'dir-inbound' },
  outbound: { label: '→ OUT', className: 'dir-outbound' },
  internal: { label: '↔ INT', className: 'dir-internal' },
  external: { label: '⇆ EXT', className: 'dir-external' },
};

function DirectionBadge({ direction }: { direction: FlowRecord['direction'] }) {
  const cfg = DIRECTION_CONFIG[direction] ?? DIRECTION_CONFIG.external;
  return <span className={`dir-badge ${cfg.className}`}>{cfg.label}</span>;
}

export default function Flows() {
  const [filters, setFilters] = useState<TrafficFilters>(defaultFilters);
  const [protocols, setProtocols] = useState<ProtocolOption[]>([]);
  const { flows, loading, loadingMore, hasMore, error, refresh, loadMore } =
    useFlowsData(filters);

  useEffect(() => {
    fetchProtocols()
      .then(setProtocols)
      .catch(() => setProtocols([]));
  }, []);

  return (
    <main className="flows-page">
      <Filters
        filters={filters}
        protocols={protocols}
        onChange={setFilters}
        onRefresh={refresh}
        loading={loading}
      />

      {error && <div className="error-banner">{error}</div>}

      <div className="flows-panel panel">
        <h2 className="panel-title">Flow Records</h2>
        <div className="flows-table-wrap">
          <table className="flows-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Time</th>
                <th>Source IP</th>
                <th>Src Port</th>
                <th>Destination IP</th>
                <th>Dst Port</th>
                <th>Protocol</th>
                <th>Bytes</th>
                <th>Packets</th>
                <th>Direction</th>
              </tr>
            </thead>
            <tbody>
              {loading && flows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="empty-row">
                    Loading flows…
                  </td>
                </tr>
              ) : flows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="empty-row">
                    No flows found for the selected filters.
                  </td>
                </tr>
              ) : (
                flows.map((f, i) => (
                  <tr key={`${f.time}-${f.src_ip}-${f.dst_ip}-${i}`}>
                    <td className="row-num">{i + 1}</td>
                    <td className="time-cell">{formatTime(f.time)}</td>
                    <td className="ip-cell">{f.src_ip}</td>
                    <td className="port-cell">{f.src_port || '—'}</td>
                    <td className="ip-cell">{f.dst_ip}</td>
                    <td className="port-cell">{f.dst_port || '—'}</td>
                    <td>{f.proto_label}</td>
                    <td>{formatBytes(f.bytes)}</td>
                    <td>{f.packets.toLocaleString()}</td>
                    <td>
                      <DirectionBadge direction={f.direction} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {hasMore && flows.length > 0 && (
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
    </main>
  );
}
