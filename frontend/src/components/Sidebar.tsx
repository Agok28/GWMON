import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: '▦', to: '/' },
  { label: 'Flows', icon: '⇄', to: '/flows' },
  { label: 'Alerts', icon: '⚠', to: '/alerts' },
  { label: 'Access Rules', icon: '⛔', to: '/access-rules' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">◉</span>
        <span className="brand-text">GWMON</span>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user">
            <span className="sidebar-user-name">{user.first_name} {user.last_name}</span>
            <span className="sidebar-user-username">@{user.username}</span>
          </div>
        )}
        <button className="nav-item logout-btn" onClick={logout}>
          <span className="nav-icon">⏻</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
