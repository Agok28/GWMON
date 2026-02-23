import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format } from 'date-fns';
import type { TrafficPoint } from '../types/traffic';

interface TrafficChartProps {
  points: TrafficPoint[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function TrafficChart({ points }: TrafficChartProps) {
  const data = points.map((p) => ({
    time: new Date(p.time).getTime(),
    bytes: p.bytes_sum,
    packets: p.packets_sum,
  }));

  return (
    <div className="panel">
      <h3 className="panel-title">Traffic Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="bytesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4fc3f7" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#4fc3f7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => format(new Date(v), 'HH:mm')}
            stroke="#888"
            fontSize={12}
          />
          <YAxis
            tickFormatter={(v: number) => formatBytes(v)}
            stroke="#888"
            fontSize={12}
            width={70}
          />
          <Tooltip
            contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 6 }}
            labelFormatter={(v: number) => format(new Date(v), 'yyyy-MM-dd HH:mm')}
            formatter={(v: number) => [formatBytes(v), 'Bytes']}
          />
          <Area
            type="monotone"
            dataKey="bytes"
            stroke="#4fc3f7"
            fill="url(#bytesGrad)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
