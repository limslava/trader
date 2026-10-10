import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../api';
import { Card, Empty, ErrorText, SignalBadge, Spinner } from '../components/ui';
import { changeColor, dateTime, money, pct, price } from '../format';

export function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['watchlist'],
    queryFn: api.watchlist,
    refetchInterval: 30_000,
  });
  const { data: ai } = useQuery({ queryKey: ['aiStatus'], queryFn: api.aiStatus, staleTime: Infinity });

  return (
    <div className="space-y-4">
      {ai && !ai.configured && (
        <div className="rounded-lg border border-hold/30 bg-hold/10 px-4 py-3 text-sm text-hold">
          AI не подключён: добавьте <code>AI_API_KEY</code> в <code>backend/.env</code> и перезапустите сервер. Котировки и
          индикаторы работают и без него.
        </div>
      )}

      <Card title="Вотчлист" actions={isLoading ? <Spinner className="text-muted" /> : null}>
        <ErrorText error={error} />
        {data?.length === 0 && (
          <Empty>Пусто. Найдите бумагу через поиск сверху и нажмите «В вотчлист».</Empty>
        )}
        {!!data?.length && (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-4 pb-2 font-normal">Бумага</th>
                  <th className="px-4 pb-2 text-right font-normal">Цена</th>
                  <th className="px-4 pb-2 text-right font-normal">Сегодня</th>
                  <th className="px-4 pb-2 text-right font-normal">Оборот</th>
                  <th className="px-4 pb-2 font-normal">Последний AI-сигнал</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.secid} className="border-t border-line hover:bg-panel-2">
                    <td className="px-4 py-2.5">
                      <Link to={`/s/${item.secid}`} className="block">
                        <span className="font-semibold">{item.secid}</span>
                        <span className="ml-2 text-muted">{item.shortname}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right">{price(item.quote?.price, item.quote?.decimals)}</td>
                    <td className={`px-4 py-2.5 text-right ${changeColor(item.quote?.changePct)}`}>
                      {pct(item.quote?.changePct)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted">{money(item.quote?.valueToday || null)}</td>
                    <td className="px-4 py-2.5">
                      {item.lastAnalysis ? (
                        <span className="flex items-center gap-2">
                          <SignalBadge signal={item.lastAnalysis.signal} confidence={item.lastAnalysis.confidence} />
                          <span className="text-xs text-muted">{dateTime(item.lastAnalysis.createdAt)}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted">нет</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
