import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api';
import { AiVerdict } from '../components/AiVerdict';
import { Analysts } from '../components/Analysts';
import { Dividends, KeyStats, NewsFeed } from '../components/CompanyStats';
import { PriceChart } from '../components/PriceChart';
import { SandboxBadge, TradeTicket } from '../components/TradeTicket';
import { Button, Delta, ErrorText, Monogram, Skeleton, Surface } from '../components/ui';
import { price } from '../format';

type Levels = { support: number[]; resistance: number[] };

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
  const wide = useWide();

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
    <div className="space-y-6">
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
        <div className="min-w-0 space-y-6">
          <Surface className="p-5 md:p-5">
            {q ? (
              <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-4xl font-semibold tracking-[-0.025em] md:text-5xl">{price(q.price, q.decimals)}</span>
                <span className="text-xl font-medium text-muted">₽</span>
                <Delta value={q.changePct} size="lg" suffix="сегодня" />
                {q.updateTime && <span className="text-xs text-muted">· {q.updateTime} МСК</span>}
              </div>
            ) : (
              <Skeleton className="mb-4 h-14 w-64" />
            )}
            <PriceChart secid={secid} levels={levels} height="h-[240px] md:h-[320px]" />
          </Surface>

          {canTrade && !wide && (
            <Surface id="trade" className="scroll-mt-20 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold tracking-tight">Сделка</h2>
                <SandboxBadge />
              </div>
              <TradeTicket secid={secid} />
            </Surface>
          )}
          <AiVerdict secid={secid} onLevels={setLevels} />
          <KeyStats secid={secid} ind={indicators.data} />
          <Analysts secid={secid} currentPrice={q?.price ?? null} />
          <Dividends secid={secid} />
          <NewsFeed secid={secid} title="Новости компании" />
        </div>

        {canTrade && wide && (
          <aside>
            <div className="lg:sticky lg:top-24">
              <Surface className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold tracking-tight">Сделка</h2>
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
