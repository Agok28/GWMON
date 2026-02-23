import type { TrafficFilters } from '../types/traffic';

interface FiltersProps {
  filters: TrafficFilters;
  onChange: (f: TrafficFilters) => void;
  onRefresh: () => void;
  loading: boolean;
}

const PRESETS: { label: string; hours: number }[] = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
];

export default function Filters({ filters, onChange, onRefresh, loading }: FiltersProps) {
  const setRange = (hours: number) => {
    const stop = new Date();
    const start = new Date(stop.getTime() - hours * 3600_000);
    onChange({ ...filters, start: start.toISOString(), stop: stop.toISOString() });
  };

  return (
    <header className="filters-bar">
      <div className="filter-group">
        <label>Time Range</label>
        <div className="preset-btns">
          {PRESETS.map((p) => (
            <button key={p.label} className="preset-btn" onClick={() => setRange(p.hours)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <label>Protocol</label>
        <select
          value={filters.proto ?? ''}
          onChange={(e) => onChange({ ...filters, proto: e.target.value || undefined })}
        >
          <option value="">All</option>
          <option value="6">TCP</option>
          <option value="17">UDP</option>
          <option value="1">ICMP</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Source IP</label>
        <input
          type="text"
          placeholder="e.g. 192.168.1.1"
          value={filters.src_ip ?? ''}
          onChange={(e) => onChange({ ...filters, src_ip: e.target.value || undefined })}
        />
      </div>

      <div className="filter-group">
        <label>Dest IP</label>
        <input
          type="text"
          placeholder="e.g. 10.0.0.1"
          value={filters.dst_ip ?? ''}
          onChange={(e) => onChange({ ...filters, dst_ip: e.target.value || undefined })}
        />
      </div>

      <button className="refresh-btn" onClick={onRefresh} disabled={loading}>
        {loading ? 'Loading…' : 'Refresh'}
      </button>
    </header>
  );
}
