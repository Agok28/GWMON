import type { TopEndpoint } from '../types/traffic';

interface TopEndpointsTableProps {
  title: string;
  endpoints: TopEndpoint[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function TopEndpointsTable({ title, endpoints }: TopEndpointsTableProps) {
  return (
    <div className="panel">
      <h3 className="panel-title">{title}</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>IP Address</th>
              <th>Bytes</th>
              <th>Packets</th>
              <th>Flows</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-row">No data</td>
              </tr>
            ) : (
              endpoints.map((ep, i) => (
                <tr key={ep.ip}>
                  <td>{i + 1}</td>
                  <td className="ip-cell">{ep.ip}</td>
                  <td>{formatBytes(ep.bytes_sum)}</td>
                  <td>{ep.packets_sum.toLocaleString()}</td>
                  <td>{ep.flows_count.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
