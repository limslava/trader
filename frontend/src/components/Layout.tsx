import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, History, House, LineChart, LogOut, Moon, Search, Sun, Swords, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { api } from '../api';
import { pct, price } from '../format';
import { useTheme } from '../theme';
import { CommandPalette } from './CommandPalette';

// Section title shown in the header; instrument pages render their own hero.
const TITLES: Record<string, string> = {
  '/market': 'Рынок',
  '/portfolio': 'Портфель',
  '/arena': 'Арена',
  '/history': 'История',
  '/learn': 'Обучение',
};

const NAV = [
  { to: '/', label: 'Обзор', Icon: House, end: true },
  { to: '/market', label: 'Рынок', Icon: LineChart, end: false },
  { to: '/portfolio', label: 'Портфель', Icon: Wallet, end: false },
  { to: '/arena', label: 'Арена', Icon: Swords, end: false },
  { to: '/history', label: 'История', Icon: History, end: false },
  { to: '/learn', label: 'Обучение', Icon: BookOpen, end: false },
];

function MarketStrip() {
  const { data } = useQuery({ queryKey: ['context'], queryFn: api.context, staleTime: 10 * 60_000 });
  if (!data) return null;
  return (
    <div className="hidden items-center gap-5 text-sm lg:flex">
      {data.imoex && (
        <div className="flex items-baseline gap-2" title="Индекс Мосбиржи, изменение за неделю">
          <span className="text-muted">IMOEX</span>
          <span className="font-semibold">{price(data.imoex.value)}</span>
          <span className={`text-xs font-semibold ${(data.imoex.change1wPct ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
            {pct(data.imoex.change1wPct)}
          </span>
        </div>
      )}
      {data.regime && (
        <div className="flex items-baseline gap-2" title={data.regime.reasons.join('; ')}>
          <span className="text-muted">Рынок</span>
          <span className="font-semibold">{data.regime.label}</span>
        </div>
      )}
      {data.keyRate && (
        <div className="flex items-baseline gap-2">
          <span className="text-muted">Ставка ЦБ</span>
          <span className="font-semibold">{price(data.keyRate.pct)}%</span>
        </div>
      )}
      {data.usdRub && (
        <div className="flex items-baseline gap-2">
          <span className="text-muted">USD</span>
          <span className="font-semibold">{price(data.usdRub.rate)} ₽</span>
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const qc = useQueryClient();
  const { theme, toggle } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const logout = async () => {
    await api.logout();
    qc.clear();
    window.location.href = '/';
  };

  const railBtn = 'grid size-9 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink';
  const isMac = navigator.platform.toLowerCase().includes('mac');

  return (
    <div className="min-h-dvh md:pl-[72px]">
      {/* Desktop: slim icon rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col items-center border-r border-line/70 bg-surface py-5 md:flex">
        <NavLink to="/" aria-label="Trader — обзор">
          <img src="/favicon.svg" alt="" className="size-9" />
        </NavLink>
        <nav className="mt-6 flex flex-col gap-1" aria-label="Разделы">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group flex w-14 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition ${
                  isActive ? 'bg-primary text-on-primary' : 'text-muted hover:bg-surface-2 hover:text-ink'
                }`
              }
            >
              <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col items-center gap-1">
          <button onClick={toggle} className={railBtn} aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
            {theme === 'dark' ? <Sun className="size-5" strokeWidth={1.75} /> : <Moon className="size-5" strokeWidth={1.75} />}
          </button>
          <button onClick={logout} className={railBtn} aria-label="Выйти" title="Выйти">
            <LogOut className="size-5" strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-line/60 bg-bg/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-4 px-4 md:px-6">
          <NavLink to="/" className="md:hidden" aria-label="Trader — обзор">
            <img src="/favicon.svg" alt="" className="size-9" />
          </NavLink>
          {TITLES[pathname] && <h1 className="hidden shrink-0 text-lg font-semibold tracking-tight md:block">{TITLES[pathname]}</h1>}
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex h-11 w-full max-w-md items-center gap-3 rounded-full border border-line/70 bg-surface px-4 text-sm text-muted shadow-soft transition hover:text-ink"
          >
            <Search className="size-4" aria-hidden />
            <span className="flex-1 text-left">Найти акцию или фонд</span>
            <kbd className="hidden rounded-md bg-surface-2 px-1.5 py-0.5 text-xs sm:inline">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <MarketStrip />
            <button onClick={toggle} className={`${railBtn} md:hidden`} aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
              {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      <main key={pathname} className="animate-rise px-4 pt-4 pb-28 md:px-6 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile: bottom tab bar */}
      <nav
        className="fixed inset-x-3 bottom-3 z-30 rounded-3xl border border-line/70 bg-surface/90 pb-[env(safe-area-inset-bottom)] shadow-2xl backdrop-blur-xl md:hidden"
        aria-label="Разделы"
      >
        <div className="grid grid-cols-5">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium ${isActive ? 'text-ink' : 'text-muted'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`grid h-7 w-12 place-items-center rounded-full ${isActive ? 'bg-primary text-on-primary' : ''}`}>
                    <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
