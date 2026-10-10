import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';
import { api, ApiError, type ImoexMember } from '../api';
import { ReviewCard } from '../components/ReviewCard';
import { Sparkline, useSparklines } from '../components/Sparkline';
import { Delta, Monogram, SectionHeader, SIGNAL_META, Skeleton, Surface } from '../components/ui';
import { money, pct, price } from '../format';

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
}

function MarketPulse() {
  const ctx = useQuery({ queryKey: ['context'], queryFn: api.context, staleTime: 10 * 60_000 });
  const spark = useSparklines(['IMOEX']);
  const imoex = ctx.data?.imoex;
  return (
    <Surface className="flex flex-col p-6 md:p-6 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-muted">Индекс Мосбиржи</div>
          {imoex ? (
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <span className="text-4xl font-semibold tracking-[-0.025em]">{price(imoex.value)}</span>
              <Delta value={imoex.change1wPct} size="lg" suffix="за неделю" />
            </div>
          ) : (
            <Skeleton className="mt-2 h-11 w-56" />
          )}
        </div>
        <Link to="/market" className="flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
          Рынок <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="my-6 h-24">
        <Sparkline data={spark.data?.IMOEX} width={600} height={112} stretch />
      </div>
      <div className="mt-auto grid grid-cols-3 gap-4 border-t border-line/70 pt-5">
        <div title="Примерно столько дают вклады — ориентир для доходности акций">
          <div className="text-xs font-medium text-muted">Ключевая ставка</div>
          <div className="mt-1 text-xl font-semibold">{ctx.data?.keyRate ? `${price(ctx.data.keyRate.pct)}%` : '—'}</div>
        </div>
        <div title="Слабый рубль помогает экспортёрам, сильный — компаниям внутри страны">
          <div className="text-xs font-medium text-muted">Доллар, ЦБ</div>
          <div className="mt-1 text-xl font-semibold">{ctx.data?.usdRub ? `${price(ctx.data.usdRub.rate)} ₽` : '—'}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted">Индекс за год</div>
          <div className={`mt-1 text-xl font-semibold ${(imoex?.change1yPct ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>{pct(imoex?.change1yPct)}</div>
        </div>
      </div>
    </Surface>
  );
}

function AccountCard() {
  const status = useQuery({ queryKey: ['tradingStatus'], queryFn: api.tradingStatus, staleTime: Infinity });
  const enabled = !!status.data?.configured && status.data.sandbox;
  const pf = useQuery({ queryKey: ['portfolio'], queryFn: api.portfolio, enabled, retry: false });
  const noAccount = pf.error instanceof ApiError && pf.error.status === 409;
  const invested = pf.data?.positions.reduce((a, p) => a + (p.value ?? 0), 0) ?? 0;

  return (
    <section className="relative flex min-h-64 flex-col gap-5 overflow-hidden rounded-[18px] bg-primary p-6 text-on-primary shadow-soft md:p-6">
      <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-gradient-to-br from-accent/50 to-accent-2/40 blur-3xl" />
      <div className="relative text-sm font-medium opacity-60">Учебный счёт · песочница</div>
      {pf.data ? (
        <>
          <div className="relative mt-1 text-3xl font-semibold tracking-[-0.025em]">{money(pf.data.total)}</div>
          <div className="relative mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="opacity-60">Свободно</div>
              <div className="mt-0.5 font-semibold">{money(pf.data.availableCash)}</div>
            </div>
            <div>
              <div className="opacity-60">В бумагах</div>
              <div className="mt-0.5 font-semibold">{money(invested)}</div>
            </div>
          </div>
        </>
      ) : (
        <p className="relative mt-3 text-sm leading-relaxed opacity-80">
          {noAccount
            ? 'Потренируйтесь покупать и продавать на виртуальные деньги — цены настоящие, риска нет.'
            : enabled
              ? 'Загружаю счёт…'
              : 'Подключите T-Invest API, чтобы торговать на учебном счёте.'}
        </p>
      )}
      <Link
        to="/portfolio"
        className="relative mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-full bg-on-primary text-sm font-semibold text-primary transition hover:opacity-90"
      >
        {noAccount ? 'Открыть учебный счёт' : 'Портфель'} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}

function AiIdea() {
  const reviews = useQuery({ queryKey: ['reviews', 'imoex'], queryFn: () => api.reviews('imoex') });
  const r = reviews.data?.[0];
  const top = r?.result.top.slice(0, 3) ?? [];
  return (
    <section className="ai-frame rounded-[18px] p-6 shadow-soft md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-accent" aria-hidden />
        Идеи AI на сегодня
      </div>
      {top.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {top.map((p) => (
            <Link key={p.secid} to={`/s/${p.secid}`} className="group rounded-2xl bg-surface-2 p-4 transition hover:-translate-y-0.5">
              <div className="mb-2 flex items-center gap-2">
                <Monogram secid={p.secid} size="sm" />
                <span className="font-semibold group-hover:underline">{p.secid}</span>
                <TrendingUp className="ml-auto size-4 text-up" aria-hidden />
              </div>
              <p className="text-sm leading-relaxed text-ink-2">{p.reason}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-xl text-sm leading-relaxed text-ink-2">
            Не знаете, с чего начать? AI разберёт 44 крупнейшие компании и покажет, какие сейчас выглядят сильнее всего.
          </p>
          <Link to="/market" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary">
            Сделать обзор рынка <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}

function Watchlist() {
  const wl = useQuery({ queryKey: ['watchlist'], queryFn: api.watchlist, refetchInterval: 30_000 });
  const spark = useSparklines(wl.data?.map((w) => w.secid) ?? []);
  return (
    <div>
      <SectionHeader title="Вотчлист" subtitle="Бумаги, за которыми вы следите" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {wl.isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-[18px]" />)}
        {wl.data?.map((w) => (
          <Link
            key={w.secid}
            to={`/s/${w.secid}`}
            className="group rounded-[18px] border border-line/70 bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 md:p-5"
          >
            <div className="flex items-center gap-3">
              <Monogram secid={w.secid} size="sm" />
              <div className="min-w-0">
                <div className="font-semibold">{w.secid}</div>
                <div className="truncate text-xs text-muted">{w.shortname}</div>
              </div>
              {w.lastAnalysis && (
                <span
                  className={`ml-auto size-2 shrink-0 rounded-full ${SIGNAL_META[w.lastAnalysis.signal].dot}`}
                  title={`AI: ${SIGNAL_META[w.lastAnalysis.signal].label}`}
                  aria-label={`AI: ${SIGNAL_META[w.lastAnalysis.signal].label}`}
                />
              )}
            </div>
            <div className="my-4 h-11">
              <Sparkline data={spark.data?.[w.secid]} width={200} height={48} stretch />
            </div>
            <div className="flex items-end justify-between gap-2">
              <span className="text-lg font-semibold tracking-tight">{price(w.quote?.price, w.quote?.decimals)}</span>
              <Delta value={w.quote?.changePct} size="sm" />
            </div>
          </Link>
        ))}
        <Link
          to="/market"
          className="grid min-h-40 place-items-center rounded-[18px] border border-dashed border-line p-4 text-center text-sm font-medium text-muted transition hover:border-ink/30 hover:text-ink"
        >
          <span>
            <Plus className="mx-auto mb-2 size-5" aria-hidden />
            Добавить из 44 компаний
          </span>
        </Link>
      </div>
    </div>
  );
}

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

export function Home() {
  const ai = useQuery({ queryKey: ['aiStatus'], queryFn: api.aiStatus, staleTime: Infinity });
  const wl = useQuery({ queryKey: ['watchlist'], queryFn: api.watchlist });
  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-xl font-semibold tracking-tight">{greeting()}</h1>
        <p className="text-sm text-muted first-letter:uppercase">{today}</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <MarketPulse />
        <AccountCard />
      </div>
      <AiIdea />
      <Watchlist />
      <Movers />
      <ReviewCard scope="watchlist" canRun={!!ai.data?.configured} count={wl.data?.length ?? 0} />
    </div>
  );
}
