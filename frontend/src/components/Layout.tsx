import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router';
import { api } from '../api';
import { SearchBox } from './SearchBox';

export function Layout() {
  const qc = useQueryClient();
  const logout = async () => {
    await api.logout();
    qc.clear();
    window.location.href = '/';
  };
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-panel-2 text-white' : 'text-muted hover:text-white'}`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <img src="/favicon.svg" alt="" className="size-6" />
            Trader
          </NavLink>
          <nav className="flex gap-1">
            <NavLink to="/" end className={link}>
              Вотчлист
            </NavLink>
            <NavLink to="/history" className={link}>
              История анализов
            </NavLink>
          </nav>
          <div className="order-last w-full sm:order-none sm:ml-auto sm:w-auto sm:flex-1 sm:justify-end sm:flex">
            <SearchBox />
          </div>
          <button onClick={logout} className="ml-auto text-sm text-muted hover:text-white sm:ml-0">
            Выйти
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted">
        Данные MOEX ISS (могут быть с задержкой до 15 минут). AI-анализ не является индивидуальной инвестиционной
        рекомендацией.
      </footer>
    </div>
  );
}
