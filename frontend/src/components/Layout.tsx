import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CandlestickChart, GraduationCap, History, LineChart, List, LogOut, Moon, Sun, Wallet } from 'lucide-react';
import { NavLink, Outlet, useMatch } from 'react-router';
import { api } from '../api';
import { pct, price } from '../format';
import { useTheme } from '../theme';
import { SearchBox } from './SearchBox';
import { Sidebar } from './Sidebar';

const NAV = [
  { to: '/', label: 'Терминал', Icon: CandlestickChart, end: true, terminal: true },
  { to: '/market', label: 'Рынок', Icon: LineChart, end: false },
  { to: '/portfolio', label: 'Портфель', Icon: Wallet, end: false },
  { to: '/history', label: 'История', Icon: History, end: false },
  { to: '/learn', label: 'Обучение', Icon: GraduationCap, end: false },
];

// Mobile has no room for the sidebar, so the instrument list becomes its own tab.
const MOBILE_NAV = [
  { to: '/list', label: 'Бумаги', Icon: List, end: false },
  ...NAV.filter((n) => !n.terminal),
];

/** Compact market strip in the top bar: index, key rate, ruble. */
function MarketStrip() {
  const { data } = useQuery({ queryKey: ['context'], queryFn: api.context, staleTime: 10 * 60_000 });
  if (!data) return null;
  const items = [
    data.imoex && { label: 'IMOEX', value: price(data.imoex.value), change: data.imoex.change1wPct, hint: 'за неделю' },
    data.keyRate && { label: 'Ставка ЦБ', value: `${price(data.keyRate.pct)}%` },
    data.usdRub && { label: 'USD', value: `${price(data.usdRub.rate)} ₽` },
  ].filter(Boolean) as { label: string; value: string; change?: number | null; hint?: string }[];
  return (
    <div className="hidden items-center gap-4 text-xs xl:flex">
      {items.map((i) => (
        <div key={i.label} className="flex items-baseline gap-1.5 whitespace-nowrap" title={i.hint}>
          <span className="text-muted">{i.label}</span>
          <span className="font-semibold">{i.value}</span>
          {i.change != null && (
            <span className={i.change > 0 ? 'text-up' : i.change < 0 ? 'text-down' : 'text-muted'}>{pct(i.change)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function Layout() {
  const qc = useQueryClient();
  const { theme, toggle } = useTheme();
  const onInstrument = useMatch('/s/:secid') !== null;
  const logout = async () => {
    await api.logout();
    qc.clear();
    window.location.href = '/';
  };

  const iconBtn = 'grid size-9 place-items-center rounded-lg text-muted transition hover:bg-panel-2 hover:text-fg';

  return (
    <div className="flex h-dvh flex-col">
      <header className="z-20 shrink-0 border-b border-line bg-panel">
        <div className="flex h-14 items-center gap-3 px-3 lg:px-4">
          <NavLink to="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight">
            <img src="/favicon.svg" alt="" className="size-7" />
            <span className="hidden sm:inline">Trader</span>
          </NavLink>
          <nav className="hidden gap-0.5 md:flex" aria-label="Разделы">
            {NAV.map(({ to, label, Icon, end, terminal }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
                    isActive || (terminal && onInstrument) ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-panel-2 hover:text-fg'
                  }`
                }
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="mx-auto w-full max-w-sm min-w-0 flex-1 md:flex-none lg:w-72">
            <SearchBox />
          </div>
          <MarketStrip />
          <div className="flex items-center">
            <button onClick={toggle} className={iconBtn} aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
              {theme === 'dark' ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
            </button>
            <button onClick={logout} className={iconBtn} aria-label="Выйти" title="Выйти">
              <LogOut className="size-4.5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-line bg-panel md:block xl:w-72" aria-label="Список бумаг">
          <Sidebar />
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <nav className="z-20 shrink-0 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Разделы">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  isActive || (to === '/list' && onInstrument) ? 'text-accent' : 'text-muted'
                }`
              }
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** Mobile/tablet page with the instrument list (the sidebar is hidden below lg). */
export function ListPage() {
  return (
    <div className="h-full bg-panel">
      <Sidebar />
    </div>
  );
}
