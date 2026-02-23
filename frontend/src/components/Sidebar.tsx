const NAV_ITEMS = [
  { label: 'Dashboard', icon: '▦', active: true },
  { label: 'Flows', icon: '⇄', active: false },
  { label: 'Alerts', icon: '⚠', active: false },
  { label: 'Settings', icon: '⚙', active: false },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">◉</span>
        <span className="brand-text">GWMON</span>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            className={`nav-item${item.active ? ' active' : ''}`}
            disabled={!item.active}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
