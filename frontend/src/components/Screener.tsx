import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api, type ScreenerRow } from '../api';
import { price } from '../format';
import { BacktestCard } from './BacktestCard';
import { SCORE_META, ScoreChip } from './ScoreBadge';
import { Delta, ErrorText, Monogram, SectionHeader, Skeleton, Surface } from './ui';

function Bar({ v }: { v: number | null }) {
  if (v == null) return <span className="text-xs text-muted">—</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
        <span className={`block h-full ${v >= 65 ? 'bg-up' : v <= 40 ? 'bg-down' : 'bg-hold'}`} style={{ width: `${v}%` }} />
      </span>
      <span className="w-6 text-right text-xs">{v}</span>
    </span>
  );
}

/** All index members ranked by the deterministic score, with the honest backtest above the table. */
export function Screener() {
  const { data, isLoading, error } = useQuery({ queryKey: ['screener'], queryFn: api.screener, staleTime: 15 * 60_000 });
  const groups: Record<ScreenerRow['score']['label'], number> = { strong: 0, neutral: 0, weak: 0 };
  for (const r of data ?? []) groups[r.score.label]++;

  return (
    <div className="space-y-4">
      <BacktestCard />
      <Surface className="p-5">
        <SectionHeader
          title="Скринер"
          subtitle={
            data
              ? `Количественная оценка 0–100: ${groups.strong} сильных · ${groups.neutral} нейтральных · ${groups.weak} слабых. Это описание текущей картины, не прогноз — см. проверку выше.`
              : 'Количественная оценка: тренд, сила относительно индекса, фундаментал'
          }
        />
        <ErrorText error={error} />
        {isLoading && <Skeleton className="h-96" />}
        {data && (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-2 pb-3 font-medium">Компания</th>
                  <th className="px-2 pb-3 font-medium">Оценка</th>
                  <th className="px-2 pb-3 font-medium">Тренд</th>
                  <th className="px-2 pb-3 font-medium">vs индекс</th>
                  <th className="px-2 pb-3 font-medium">Фундаментал</th>
                  <th className="px-2 pb-3 text-right font-medium">Цена</th>
                  <th className="px-2 pb-3 text-right font-medium">Сегодня</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.secid} className="group border-t border-line/70">
                    <td className="px-2 py-2.5">
                      <Link to={`/s/${r.secid}`} className="flex items-center gap-3">
                        <Monogram secid={r.secid} size="sm" />
                        <span className="min-w-0">
                          <span className="block font-semibold group-hover:underline">{r.secid}</span>
                          <span className="block truncate text-xs text-muted">{r.shortname}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-2 py-2.5">
                      <ScoreChip score={r.score} />
                    </td>
                    <td className="px-2 py-2.5"><Bar v={r.score.tech.score} /></td>
                    <td className="px-2 py-2.5"><Bar v={r.score.relative.score} /></td>
                    <td className="px-2 py-2.5"><Bar v={r.score.fundamental?.score ?? null} /></td>
                    <td className="px-2 py-2.5 text-right font-semibold">{price(r.price)}</td>
                    <td className="px-2 py-2.5 text-right"><Delta value={r.changePct} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          {Object.entries(SCORE_META).map(([k, m]) => (
            <span key={k} className={`mr-3 ${m.tone}`}>
              {m.label}: {k === 'strong' ? '65+' : k === 'weak' ? '40 и ниже' : '41–64'}
            </span>
          ))}
        </p>
      </Surface>
    </div>
  );
}
