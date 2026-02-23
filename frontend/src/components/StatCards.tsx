interface StatCardsProps {
  totalBytes: number;
  totalPackets: number;
  totalFlows: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export default function StatCards({ totalBytes, totalPackets, totalFlows }: StatCardsProps) {
  const cards = [
    { label: 'Total Traffic', value: formatBytes(totalBytes), accent: '#4fc3f7' },
    { label: 'Total Packets', value: formatNumber(totalPackets), accent: '#81c784' },
    { label: 'Total Flows', value: formatNumber(totalFlows), accent: '#ffb74d' },
  ];

  return (
    <div className="stat-cards">
      {cards.map((c) => (
        <div key={c.label} className="stat-card" style={{ borderTopColor: c.accent }}>
          <span className="stat-value">{c.value}</span>
          <span className="stat-label">{c.label}</span>
        </div>
      ))}
    </div>
  );
}
