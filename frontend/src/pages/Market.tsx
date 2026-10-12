import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownUp, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, type ImoexMember } from '../api';
import { NewsFeed } from '../components/CompanyStats';
import { PriceChart } from '../components/PriceChart';
import { ReviewCard } from '../components/ReviewCard';
import { TradeDialog } from '../components/TradeDialog';
import { Sparkline, useSparklines } from '../components/Sparkline';
import { Button, Delta, ErrorText, Monogram, SectionHeader, Segmented, Skeleton, Surface } from '../components/ui';

function MoverList({ title, items, Icon, tone }: { title: string; items: ImoexMember[]; Icon: typeof TrendingUp; tone: string }) {
  return (
    <Surface className="p-5 md:p-6">
      <h3 className={`mb-3 flex items-center gap-2 font-semibold ${tone}`}>
        <Icon className="size-4" aria-hidden />
        {title}
      </h3>
      <ul className="divide-y divide-line/70">
        {items.map((m) => (
          <li key={m.secid}>
            <Link to={`/s/${m.secid}`} className="flex items-center gap-3 py-2.5">
              <Monogram secid={m.secid} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{m.secid}</span>
                <span className="block truncate text-xs text-muted">{m.shortname}</span>
              </span>
              <span className="text-right">
                <span className="block text-sm font-semibold">{price(m.quote?.price)}</span>
                <Delta value={m.quote?.changePct} size="sm" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Surface>
  );
}

function Movers() {
  const { data } = useQuery({ queryKey: ['imoex'], queryFn: api.imoex, refetchInterval: 60_000 });
  if (!data) return null;
  const sorted = [...data].filter((m) => m.quote).sort((a, b) => (b.quote!.changePct ?? 0) - (a.quote!.changePct ?? 0));
  if (sorted.every((m) => !m.quote!.changePct)) return null; // before the session opens there is nothing to rank
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <MoverList title="Растут сегодня" items={sorted.slice(0, 5)} Icon={TrendingUp} tone="text-up" />
      <MoverList title="Падают сегодня" items={sorted.slice(-5).reverse()} Icon={TrendingDown} tone="text-down" />
    </div>
  );
}

import { money, price } from '../format';

type Sort = 'weight' | 'gainers' | 'losers';

function Companies() {
  const qc = useQueryClient();
  const [sort, setSort] = useState<Sort>('weight');
  const [trade, setTrade] = useState<string>();
  const trading = useQuery({ queryKey: ['tradingStatus'], queryFn: api.tradingStatus, staleTime: Infinity });
  const canTrade = !!trading.data?.configured && trading.data.sandbox;
  const members = useQuery({ queryKey: ['imoex'], queryFn: api.imoex, refetchInterval: 60_000 });
  const watchlist = useQuery({ queryKey: ['watchlist'], queryFn: api.watchlist });
  const spark = useSparklines(members.data?.map((m) => m.secid) ?? []);
  const watched = new Set(watchlist.data?.map((w) => w.secid));
  const toggle = useMutation({
    mutationFn: (secid: string) => (watched.has(secid) ? api.unwatch(secid) : api.watch(secid)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const rows = [...(members.data ?? [])].sort((a, b) =>
    sort === 'weight' ? b.weight - a.weight : ((b.quote?.changePct ?? 0) - (a.quote?.changePct ?? 0)) * (sort === 'gainers' ? 1 : -1),
  );

  return (
    <Surface className="p-5 md:p-5">
      <SectionHeader
        title="Крупнейшие компании"
        subtitle={members.data ? `${members.data.length} бумаги индекса Мосбиржи — с них обычно начинают` : 'Бумаги индекса Мосбиржи — с них обычно начинают'}
        action={
          <Segmented
            size="sm"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'weight', label: 'По весу' },
              { value: 'gainers', label: 'Рост' },
              { value: 'losers', label: 'Падение' },
            ]}
          />
        }
      />
      <ErrorText error={members.error} />
      {members.isLoading && <Skeleton className="h-96" />}
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="w-10 px-2 pb-3 font-medium" />
              <th className="px-2 pb-3 font-medium">Компания</th>
              <th className="px-2 pb-3 font-medium">30 дней</th>
              <th className="px-2 pb-3 text-right font-medium">Цена</th>
              <th className="px-2 pb-3 text-right font-medium">Сегодня</th>
              <th className="px-2 pb-3 text-right font-medium" title="Минимальная сумма покупки">
                1 лот
              </th>
              <th className="px-2 pb-3 text-right font-medium" title="Доля в индексе">
                <span className="inline-flex items-center gap-1">
                  Вес <ArrowDownUp className="size-3" aria-hidden />
                </span>
              </th>
              {canTrade && <th className="px-2 pb-3" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const q = m.quote;
              const isWatched = watched.has(m.secid);
              return (
                <tr key={m.secid} className="group border-t border-line/70">
                  <td className="px-2 py-3">
                    <button
                      onClick={() => toggle.mutate(m.secid)}
                      disabled={toggle.isPending || !watchlist.data}
                      className={`grid size-8 place-items-center rounded-full transition ${isWatched ? 'text-hold' : 'text-muted/50 hover:text-hold'}`}
                      aria-label={isWatched ? `Убрать ${m.secid} из вотчлиста` : `Добавить ${m.secid} в вотчлист`}
                      title={isWatched ? 'Убрать из вотчлиста' : 'В вотчлист'}
                    >
                      <Star className={`size-4 ${isWatched ? 'fill-current' : ''}`} />
                    </button>
                  </td>
                  <td className="px-2 py-3">
                    <Link to={`/s/${m.secid}`} className="flex items-center gap-3">
                      <Monogram secid={m.secid} size="sm" />
                      <span className="min-w-0">
                        <span className="block font-semibold group-hover:underline">{m.secid}</span>
                        <span className="block truncate text-xs text-muted">{m.shortname}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-2 py-3">
                    <Sparkline data={spark.data?.[m.secid]} width={88} height={28} />
                  </td>
                  <td className="px-2 py-3 text-right font-semibold">{price(q?.price, q?.decimals)}</td>
                  <td className="px-2 py-3 text-right">
                    <Delta value={q?.changePct} size="sm" />
                  </td>
                  <td className="px-2 py-3 text-right text-muted">{q?.price != null ? money(q.price * q.lotSize) : '—'}</td>
                  <td className="px-2 py-3 text-right text-muted">{price(m.weight, 1)}%</td>
                  {canTrade && (
                    <td className="px-2 py-3 text-right">
                      <Button size="sm" variant="up" onClick={() => setTrade(m.secid)}>
                        Купить
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {trade && <TradeDialog secid={trade} onClose={() => setTrade(undefined)} />}
    </Surface>
  );
}

export function Market() {
  const ai = useQuery({ queryKey: ['aiStatus'], queryFn: api.aiStatus, staleTime: Infinity });
  const members = useQuery({ queryKey: ['imoex'], queryFn: api.imoex, refetchInterval: 60_000 });
  const ctx = useQuery({ queryKey: ['context'], queryFn: api.context, staleTime: 10 * 60_000 });
  const imoex = ctx.data?.imoex;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Surface className="flex flex-col p-5">
          <div className="text-sm font-medium text-muted">Индекс Мосбиржи · IMOEX</div>
          <div className="mt-1 mb-4 text-4xl font-semibold tracking-[-0.025em]">{imoex ? price(imoex.value) : <Skeleton className="h-11 w-48" />}</div>
          <div className="min-h-[300px] flex-1">
            <PriceChart secid="IMOEX" fill />
          </div>
        </Surface>
        <div className="grid gap-3">
          {[
            {
              label: 'Ключевая ставка ЦБ',
              value: ctx.data?.keyRate ? `${price(ctx.data.keyRate.pct)}%` : '—',
              hint: 'Примерно столько дают вклады. Акции должны приносить больше — иначе проще вклад. Снижение ставки обычно помогает акциям.',
            },
            {
              label: 'Доллар, курс ЦБ',
              value: ctx.data?.usdRub ? `${price(ctx.data.usdRub.rate)} ₽` : '—',
              hint: 'Слабый рубль выгоден экспортёрам (нефть, газ, металлы), сильный — компаниям внутри страны.',
            },
            {
              label: 'Индекс за год',
              value: imoex?.change1yPct != null ? <Delta value={imoex.change1yPct} size="lg" /> : '—',
              hint: `За месяц ${imoex?.change1mPct != null ? `${imoex.change1mPct > 0 ? '+' : ''}${price(imoex.change1mPct)}%` : '—'}, за 3 месяца ${
                imoex?.change3mPct != null ? `${imoex.change3mPct > 0 ? '+' : ''}${price(imoex.change3mPct)}%` : '—'
              }.`,
            },
          ].map((s) => (
            <Surface key={s.label} className="p-5">
              <div className="text-sm font-medium text-muted">{s.label}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">{s.value}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{s.hint}</p>
            </Surface>
          ))}
        </div>
      </div>

      <Movers />
      <ReviewCard scope="imoex" canRun={!!ai.data?.configured} count={members.data?.length ?? 0} />
      <Companies />
      <NewsFeed title="Новости рынка" />
    </div>
  );
}
