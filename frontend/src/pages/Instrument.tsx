import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api';
import { AiVerdict } from '../components/AiVerdict';
import { DecisionSummary } from '../components/DecisionSummary';
import { Freshness } from '../components/Freshness';
import { Peers } from '../components/Peers';
import { Analysts } from '../components/Analysts';
import { Dividends, KeyStats, NewsFeed } from '../components/CompanyStats';
import { PriceChart } from '../components/PriceChart';
import { SandboxBadge, TradeTicket } from '../components/TradeTicket';
import { Button, Delta, ErrorText, Monogram, Skeleton, Surface, Tabs } from '../components/ui';
import { price } from '../format';

type Levels = { support: number[]; resistance: number[] };
type Tab = 'ai' | 'stats' | 'analysts' | 'dividends' | 'news';

/** Matches Tailwind's lg breakpoint; the trade ticket is rendered once, in whichever slot fits. */
function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const on = () => setWide(mql.matches);
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, []);
  return wide;
}

export function Instrument() {
  const secid = useParams().secid!.toUpperCase();
  const qc = useQueryClient();
  const [levels, setLevels] = useState<Levels>();
  const [tab, setTab] = useState<Tab>('ai');
  const wide = useWide();
  // A new instrument starts on the verdict tab.
  useEffect(() => setTab('ai'), [secid]);

  const quote = useQuery({ queryKey: ['quote', secid], queryFn: () => api.quote(secid), refetchInterval: 20_000 });
  const indicators = useQuery({ queryKey: ['indicators', secid], queryFn: () => api.indicators(secid) });
  const watchlist = useQuery({ queryKey: ['watchlist'], queryFn: api.watchlist });
  const trading = useQuery({ queryKey: ['tradingStatus'], queryFn: api.tradingStatus, staleTime: Infinity });
  const canTrade = !!trading.data?.configured && trading.data.sandbox;

  const inWatchlist = watchlist.data?.some((w) => w.secid === secid) ?? false;
  const toggleWatch = useMutation({
    mutationFn: () => (inWatchlist ? api.unwatch(secid) : api.watch(secid)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const q = quote.data;
  if (quote.error) {
    return (
      <Surface className="p-6">
        <ErrorText error={quote.error} />
        <Link to="/market" className="mt-3 inline-block text-sm font-semibold text-accent">
          Открыть список компаний
        </Link>
      </Surface>
    );
  }

  return (
    <div className="space-y-4">
      <Link to="/market" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden />
        Рынок
      </Link>

      {/* Hero */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <Monogram secid={secid} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight md:text-2xl">{q?.shortname ?? secid}</h1>
            <p className="truncate text-sm text-muted">
              {secid} · {q?.name}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => toggleWatch.mutate()} disabled={toggleWatch.isPending || !watchlist.data} aria-pressed={inWatchlist}>
            <Star className={`size-4 ${inWatchlist ? 'fill-current text-hold' : ''}`} aria-hidden />
            {inWatchlist ? 'В вотчлисте' : 'В вотчлист'}
          </Button>
          {canTrade && (
            <a href="#trade" className="lg:hidden">
              <Button variant="primary">Купить</Button>
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Surface className="p-5">
            {q ? (
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-4xl font-semibold tracking-[-0.025em]">{price(q.price, q.decimals)}</span>
                <span className="text-xl font-medium text-muted">₽</span>
                <Delta value={q.changePct} size="lg" suffix="сегодня" />
                <Freshness updateTime={q.updateTime} />
              </div>
            ) : (
              <Skeleton className="mb-3 h-12 w-64" />
            )}
            <PriceChart secid={secid} levels={levels} height="h-[220px] md:h-[260px]" />
          </Surface>

          <DecisionSummary secid={secid} currentPrice={q?.price ?? null} onTab={(t) => setTab(t as Tab)} />

          {canTrade && !wide && (
            <Surface id="trade" className="scroll-mt-20 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold tracking-tight">Сделка</h2>
                <SandboxBadge />
              </div>
              <TradeTicket secid={secid} />
            </Surface>
          )}

          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'ai', label: 'Вердикт AI' },
              { value: 'stats', label: 'Показатели' },
              { value: 'analysts', label: 'Аналитики' },
              { value: 'dividends', label: 'Дивиденды' },
              { value: 'news', label: 'Новости' },
            ]}
          />
          <div key={tab} className="animate-rise">
            {tab === 'ai' && <AiVerdict secid={secid} onLevels={setLevels} />}
            {tab === 'stats' && (
              <div className="space-y-4">
                <KeyStats secid={secid} ind={indicators.data} />
                <Peers secid={secid} />
              </div>
            )}
            {tab === 'analysts' && <Analysts secid={secid} currentPrice={q?.price ?? null} />}
            {tab === 'dividends' && <Dividends secid={secid} />}
            {tab === 'news' && <NewsFeed secid={secid} title="Новости компании" />}
          </div>
        </div>

        {canTrade && wide && (
          <aside>
            <div className="lg:sticky lg:top-20">
              <Surface className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold tracking-tight">Сделка</h2>
                  <SandboxBadge />
                </div>
                <TradeTicket secid={secid} />
              </Surface>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
