import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import { PriceChart } from '../components/PriceChart';
import { ReviewCard } from '../components/ReviewCard';
import { Card, ErrorText, Spinner } from '../components/ui';
import { changeColor, pct, price } from '../format';

function Stat({ label, value, sub, hint }: { label: string; value: ReactNode; sub?: ReactNode; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-sm">{sub}</div>}
      <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p>
    </div>
  );
}

export function Market() {
  const qc = useQueryClient();
  const ctx = useQuery({ queryKey: ['context'], queryFn: api.context, staleTime: 10 * 60_000 });
  const members = useQuery({ queryKey: ['imoex'], queryFn: api.imoex, refetchInterval: 60_000 });
  const watchlist = useQuery({ queryKey: ['watchlist'], queryFn: api.watchlist });
  const ai = useQuery({ queryKey: ['aiStatus'], queryFn: api.aiStatus, staleTime: Infinity });

  const watched = new Set(watchlist.data?.map((w) => w.secid));
  const toggle = useMutation({
    mutationFn: (secid: string) => (watched.has(secid) ? api.unwatch(secid) : api.watch(secid)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const imoex = ctx.data?.imoex;
  const keyRate = ctx.data?.keyRate;
  const usd = ctx.data?.usdRub;

  return (
    <div className="space-y-4">
      <ErrorText error={ctx.error} />
      <div className="grid gap-3 md:grid-cols-3">
        <Stat
          label="Индекс Мосбиржи"
          value={imoex ? price(imoex.value) : '—'}
          sub={
            imoex && (
              <span className="flex flex-wrap gap-x-3">
                <span className={changeColor(imoex.change1wPct)}>неделя {pct(imoex.change1wPct)}</span>
                <span className={changeColor(imoex.change1mPct)}>месяц {pct(imoex.change1mPct)}</span>
                <span className={changeColor(imoex.change1yPct)}>год {pct(imoex.change1yPct)}</span>
              </span>
            )
          }
          hint="Средняя «температура» рынка: как в целом меняются цены 44 крупнейших компаний."
        />
        <Stat
          label="Ключевая ставка ЦБ"
          value={keyRate ? `${price(keyRate.pct)}%` : '—'}
          hint="Примерно столько дают вклады. Акции должны приносить больше — иначе проще положить деньги на вклад. Снижение ставки обычно помогает акциям расти."
        />
        <Stat
          label="Доллар (курс ЦБ)"
          value={usd ? `${price(usd.rate)} ₽` : '—'}
          hint="Слабый рубль выгоден экспортёрам (нефть, газ, металлы, удобрения), сильный — компаниям, работающим внутри страны."
        />
      </div>

      <Card title="Индекс Мосбиржи (IMOEX)">
        <PriceChart secid="IMOEX" />
      </Card>

      <ReviewCard scope="imoex" canRun={!!ai.data?.configured} count={members.data?.length ?? 0} />

      <Card title="Компании индекса" actions={members.isLoading ? <Spinner className="text-muted" /> : null}>
        <p className="mb-3 text-sm text-muted">
          Крупнейшие и самые ликвидные компании России — с них обычно и начинают. «Вес» — доля компании в индексе.
          «1 лот» — минимальная сумма для покупки. ☆ добавляет бумагу в вотчлист.
        </p>
        <ErrorText error={members.error} />
        {members.data && (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="w-8 px-4 pb-2" />
                  <th className="px-2 pb-2 font-normal">Компания</th>
                  <th className="px-4 pb-2 text-right font-normal">Вес</th>
                  <th className="px-4 pb-2 text-right font-normal">Цена</th>
                  <th className="px-4 pb-2 text-right font-normal">Сегодня</th>
                  <th className="px-4 pb-2 text-right font-normal">1 лот</th>
                </tr>
              </thead>
              <tbody>
                {members.data.map((m) => {
                  const q = m.quote;
                  const isWatched = watched.has(m.secid);
                  return (
                    <tr key={m.secid} className="border-t border-line hover:bg-panel-2">
                      <td className="px-4 py-2">
                        <button
                          onClick={() => toggle.mutate(m.secid)}
                          disabled={toggle.isPending || !watchlist.data}
                          className={isWatched ? 'text-hold' : 'text-muted hover:text-hold'}
                          title={isWatched ? 'Убрать из вотчлиста' : 'Добавить в вотчлист'}
                        >
                          {isWatched ? '★' : '☆'}
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <Link to={`/s/${m.secid}`} className="hover:underline">
                          <span className="font-semibold">{m.secid}</span>
                          <span className="ml-2 text-muted">{m.shortname}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right text-muted">{price(m.weight)}%</td>
                      <td className="px-4 py-2 text-right">{price(q?.price, q?.decimals)}</td>
                      <td className={`px-4 py-2 text-right ${changeColor(q?.changePct)}`}>{pct(q?.changePct)}</td>
                      <td className="px-4 py-2 text-right text-muted">
                        {q?.price != null ? `${price(q.price * q.lotSize, 0)} ₽` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
