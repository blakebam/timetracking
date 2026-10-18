import { APP_NAME, todayIso } from '@tt/shared';
import { Navigate, NavLink, Route, Routes } from 'react-router';
import styles from './App.module.css';
import { ServerStatus } from './components/ServerStatus';
import { CalendarPage } from './features/calendar/CalendarPage';
import { DayPage } from './features/day/DayPage';
import { InvoicesPage } from './features/invoices/InvoicesPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { WeekPage } from './features/week/WeekPage';

const NAV_ITEMS = [
  { to: '/day', label: 'Day' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/week', label: 'Week' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/settings', label: 'Settings' },
];

function Placeholder({ title }: { title: string }) {
  return <h1>{title}</h1>;
}

export function App() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>{APP_NAME}</span>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Navigate to={`/day/${todayIso()}`} replace />} />
          <Route path="/day" element={<DayPage />} />
          <Route path="/day/:date" element={<DayPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/week" element={<WeekPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Placeholder title="Page not found" />} />
        </Routes>
      </main>

      <footer className={styles.footer}>
        <ServerStatus />
      </footer>
    </div>
  );
}
