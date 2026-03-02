import { useMemo } from 'react';
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
  start: string;
  stop: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function smartDateFormat(rangeMs: number): (ts: number) => string {
  if (rangeMs <= 6 * 3600_000) return (v) => format(new Date(v), 'HH:mm');
  if (rangeMs <= 48 * 3600_000) return (v) => format(new Date(v), 'MMM d HH:mm');
  return (v) => format(new Date(v), 'MMM d');
}

export default function TrafficChart({ points, start, stop }: TrafficChartProps) {
  const startMs = new Date(start).getTime();
  const stopMs = new Date(stop).getTime();
  const rangeMs = stopMs - startMs;

  const data = useMemo(() => {
    const mapped = points.map((p) => ({
      time: new Date(p.time).getTime(),
      bytes: p.bytes_sum,
      packets: p.packets_sum,
    }));

    mapped.sort((a, b) => a.time - b.time);

    if (mapped.length === 0) {
      return [
        { time: startMs, bytes: 0, packets: 0 },
        { time: stopMs, bytes: 0, packets: 0 },
      ];
    }

    const GAP_THRESHOLD = 5 * 60_000;
    const OFFSET = 60_000;
    const zero = { bytes: 0, packets: 0 };
    const result: typeof mapped = [];

    const firstDataTime = mapped[0].time;
    const lastDataTime = mapped[mapped.length - 1].time;

    if (firstDataTime - startMs > OFFSET) {
      result.push({ time: startMs, ...zero });
      result.push({ time: firstDataTime - OFFSET, ...zero });
    }

    for (let i = 0; i < mapped.length; i++) {
      if (i > 0 && mapped[i].time - mapped[i - 1].time > GAP_THRESHOLD) {
        result.push({ time: mapped[i - 1].time + OFFSET, ...zero });
        result.push({ time: mapped[i].time - OFFSET, ...zero });
      }
      result.push(mapped[i]);
    }

    if (stopMs - lastDataTime > OFFSET) {
      result.push({ time: lastDataTime + OFFSET, ...zero });
      result.push({ time: stopMs, ...zero });
    }

    return result;
  }, [points, startMs, stopMs]);

  const tickFormatter = smartDateFormat(rangeMs);

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
            domain={[startMs, stopMs]}
            tickFormatter={tickFormatter}
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
