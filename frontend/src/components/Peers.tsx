import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api, SECTOR_RU } from '../api';
import { pct, price } from '../format';
import { ScoreChip } from './ScoreBadge';
import { Empty, Monogram, SectionHeader, Skeleton, Surface } from './ui';

/** The instrument against its index peers from the same sector. */
export function Peers({ secid }: { secid: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['peers', secid], queryFn: () => api.peers(secid), staleTime: 15 * 60_000 });
  if (isLoading) return <Skeleton className="h-40 rounded-[18px]" />;
  if (!data?.sector) return null;
  const peers = [...data.peers].sort((a, b) => b.score.total - a.score.total);
  const median = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  };
  const others = peers.filter((p) => p.secid !== secid);
  const medPe = median(others.map((p) => p.ratios.pe));
  const medDy = median(others.map((p) => p.ratios.dividendYieldPct));

  return (
    <Surface className="p-5">
      <SectionHeader
        title={`Аналоги: ${SECTOR_RU[data.sector] ?? data.sector}`}
        subtitle={others.length ? `Медиана по сектору: P/E ${medPe != null ? price(medPe, 1) : '—'}, дивиденды ${medDy != null ? `${price(medDy, 1)}%` : '—'}` : undefined}
      />
      {others.length === 0 && <Empty>В индексе нет других компаний этого сектора.</Empty>}
      {others.length > 0 && (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-2 pb-2 font-medium">Компания</th>
                <th className="px-2 pb-2 font-medium">Оценка</th>
                <th className="px-2 pb-2 text-right font-medium">P/E</th>
                <th className="px-2 pb-2 text-right font-medium">Дивиденды</th>
                <th className="px-2 pb-2 text-right font-medium">ROE</th>
                <th className="px-2 pb-2 text-right font-medium">3 мес</th>
              </tr>
            </thead>
            <tbody>
              {peers.map((p) => {
                const me = p.secid === secid;
                return (
                  <tr key={p.secid} className={`border-t border-line/70 ${me ? 'bg-surface-2/70 font-semibold' : ''}`}>
                    <td className="px-2 py-2">
                      <Link to={`/s/${p.secid}`} className="flex items-center gap-2 hover:underline">
                        <Monogram secid={p.secid} size="sm" />
                        <span>
                          {p.secid}
                          {me && <span className="ml-1 text-xs font-normal text-muted">— эта бумага</span>}
                        </span>
                      </Link>
                    </td>
                    <td className="px-2 py-2"><ScoreChip score={p.score} /></td>
                    <td className="px-2 py-2 text-right">{p.ratios.pe != null ? price(p.ratios.pe, 1) : '—'}</td>
                    <td className="px-2 py-2 text-right">{p.ratios.dividendYieldPct != null ? `${price(p.ratios.dividendYieldPct, 1)}%` : '—'}</td>
                    <td className="px-2 py-2 text-right">{p.ratios.roePct != null ? `${price(p.ratios.roePct, 0)}%` : '—'}</td>
                    <td className={`px-2 py-2 text-right ${(p.ratios.change3mPct ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>{pct(p.ratios.change3mPct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Surface>
  );
}
