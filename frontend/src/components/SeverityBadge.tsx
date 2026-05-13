interface SeverityBadgeProps {
  severity: number | null | undefined;
}

interface SeverityConfig {
  label: string;
  className: string;
}

function configFor(severity: number | null | undefined): SeverityConfig {
  if (severity === 1) return { label: 'CRITICAL', className: 'sev-critical' };
  if (severity === 2) return { label: 'HIGH', className: 'sev-high' };
  if (severity === 3) return { label: 'MEDIUM', className: 'sev-medium' };
  if (severity !== null && severity !== undefined && severity >= 4) {
    return { label: 'LOW', className: 'sev-low' };
  }
  return { label: 'UNKNOWN', className: 'sev-unknown' };
}

export default function SeverityBadge({ severity }: SeverityBadgeProps) {
  const cfg = configFor(severity);
  return <span className={`sev-badge ${cfg.className}`}>{cfg.label}</span>;
}
