import { NavLink, Outlet } from 'react-router-dom';
import { Gauge, Library, Upload, PlaySquare, History, Settings as Cog } from 'lucide-react';

const NAV = [
  { to: '/', label: 'Dashboard', icon: Gauge, end: true },
  { to: '/banks', label: 'Question Banks', icon: Library },
  { to: '/import', label: 'Import Questions', icon: Upload },
  { to: '/configure', label: 'New Test', icon: PlaySquare },
  { to: '/history', label: 'Test History', icon: History },
  { to: '/settings', label: 'Settings', icon: Cog },
];

export default function Layout() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">EXAM LAB</div>
        <nav>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon size={17} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot caption">Offline · Local data only</div>
      </aside>
      <header className="topbar"><div className="brand">EXAM LAB</div></header>
      <main className="content"><Outlet /></main>
      <nav className="bottomnav">
        {NAV.filter((n) => n.to !== '/import').map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `bn-link${isActive ? ' active' : ''}`}>
            <Icon size={19} /><span>{label.replace('Question Banks', 'Banks').replace('Test History', 'History')}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
