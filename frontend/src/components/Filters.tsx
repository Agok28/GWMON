import { useState } from 'react';
import type { TrafficFilters, ProtocolOption } from '../types/traffic';

interface FiltersProps {
  filters: TrafficFilters;
  protocols: ProtocolOption[];
  onChange: (f: TrafficFilters) => void;
  onRefresh: () => void;
  onExportPdf?: () => void;
  loading: boolean;
}

const PRESETS: { label: string; hours: number }[] = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
];

export default function Filters({ filters, protocols, onChange, onRefresh, onExportPdf, loading }: FiltersProps) {
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const setRange = (hours: number, label: string) => {
    const stop = new Date();
    const start = new Date(stop.getTime() - hours * 3600_000);
    setActivePreset(label);
    onChange({ ...filters, start: start.toISOString(), stop: stop.toISOString() });
  };

  return (
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
        <label>Protocol</label>
        <select
          value={filters.proto ?? ''}
          onChange={(e) => onChange({ ...filters, proto: e.target.value || undefined })}
        >
          <option value="">All</option>
          {protocols.map((p) => (
            <option key={p.proto} value={p.proto}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Direction</label>
        <select
          value={filters.direction ?? ''}
          onChange={(e) => onChange({ ...filters, direction: e.target.value || undefined })}
        >
          <option value="">All</option>
          <option value="outbound">Outbound</option>
          <option value="inbound">Inbound</option>
          <option value="internal">Internal</option>
          <option value="external">External</option>
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

      <div className="filter-group">
        <label>Src Port</label>
        <input
          type="number"
          placeholder="e.g. 443"
          min={0}
          max={65535}
          value={filters.src_port ?? ''}
          onChange={(e) => onChange({ ...filters, src_port: e.target.value ? Number(e.target.value) : undefined })}
        />
      </div>

      <div className="filter-group">
        <label>Dst Port</label>
        <input
          type="number"
          placeholder="e.g. 80"
          min={0}
          max={65535}
          value={filters.dst_port ?? ''}
          onChange={(e) => onChange({ ...filters, dst_port: e.target.value ? Number(e.target.value) : undefined })}
        />
      </div>

      <div className="filter-actions">
        {onExportPdf && (
          <button className="export-btn" onClick={onExportPdf} disabled={loading}>
            Export PDF
          </button>
        )}
        <button className="refresh-btn" onClick={onRefresh} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
    </header>
  );
}
