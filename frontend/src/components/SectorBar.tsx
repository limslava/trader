import { useQuery } from '@tanstack/react-query';
import { api, SECTOR_RU, type Position } from '../api';
import { price } from '../format';

const COLORS = ['var(--ink)', 'var(--accent)', 'var(--accent-2)', 'var(--up)', 'var(--hold)', 'var(--down)', '#8b5cf6', '#f97316', '#14b8a6', '#64748b'];

/** Portfolio sector mix next to the index mix; big gaps mean concentration risk. */
export function SectorBar({ positions, cash, total }: { positions: Position[]; cash: number; total: number }) {
  const index = useQuery({ queryKey: ['sectors'], queryFn: api.sectors, staleTime: 60 * 60_000 });
  if (!total) return null;
  const mine = new Map<string, number>();
  for (const p of positions) mine.set(p.sector, (mine.get(p.sector) ?? 0) + ((p.value ?? 0) / total) * 100);
  if (cash > 0) mine.set('cash', (cash / total) * 100);
  const idx = new Map((index.data ?? []).map((s) => [s.sector, s.weightPct]));
  const sectors = [...new Set([...mine.keys(), ...idx.keys()])].sort((a, b) => (mine.get(b) ?? 0) - (mine.get(a) ?? 0));
  const color = (s: string) => (s === 'cash' ? 'var(--line)' : COLORS[sectors.indexOf(s) % COLORS.length]);
  const label = (s: string) => (s === 'cash' ? 'Деньги' : (SECTOR_RU[s] ?? s));

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted">
        <span>По отраслям</span>
        <span>для сравнения — индекс Мосбиржи</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Отрасли портфеля">
        {sectors.filter((s) => mine.get(s)).map((s) => (
          <span key={s} style={{ width: `${mine.get(s)}%`, background: color(s) }} title={`${label(s)}: ${price(mine.get(s)!, 1)}%`} />
        ))}
      </div>
      <ul className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
        {sectors
          .filter((s) => (mine.get(s) ?? 0) > 0 || (idx.get(s) ?? 0) >= 5)
          .map((s) => {
            const m = mine.get(s) ?? 0;
            const i = s === 'cash' ? null : (idx.get(s) ?? 0);
            const gap = i != null ? m - i : null;
            return (
              <li key={s} className="flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ background: color(s) }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{label(s)}</span>
                <b>{price(m, 1)}%</b>
                {i != null && (
                  <span className={`w-20 text-right ${gap != null && Math.abs(gap) >= 15 ? (gap > 0 ? 'text-hold' : 'text-muted') : 'text-muted'}`}>
                    индекс {price(i, 0)}%
                  </span>
                )}
              </li>
            );
          })}
      </ul>
    </div>
  );
}
