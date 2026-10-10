import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api';
import { AnalysisView } from '../components/AnalysisView';
import { CompanyCard } from '../components/CompanyCard';
import { IndicatorsGrid } from '../components/IndicatorsGrid';
import { NewsCard } from '../components/NewsList';
import { PriceChart } from '../components/PriceChart';
import { TradePanel } from '../components/TradePanel';
import { Button, Empty, ErrorText, SignalBadge, Spinner } from '../components/ui';
import { dateTime, pct, price } from '../format';

/** True on wide screens, where AI and trading live in the right-hand panel instead of tabs. */
function useWide() {
  const query = '(min-width: 1280px)';
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const on = () => setWide(mql.matches);
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, []);
  return wide;
}

function AiPanel({ secid, onLevels }: { secid: string; onLevels: (l?: { support: number[]; resistance: number[] }) => void }) {
  const qc = useQueryClient();
  const [question, setQuestion] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const history = useQuery({ queryKey: ['analyses', secid], queryFn: () => api.analyses(secid) });
  const ai = useQuery({ queryKey: ['aiStatus'], queryFn: api.aiStatus, staleTime: Infinity });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['analyses'] });
    qc.invalidateQueries({ queryKey: ['watchlist'] });
  };
  const analyze = useMutation({
    mutationFn: () => api.analyze(secid, question.trim() || undefined),
    onSuccess: (a) => {
      setQuestion('');
      setSelectedId(a.id);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteAnalysis(id),
    onSuccess: () => {
      setSelectedId(null);
      refresh();
    },
  });

  const analyses = history.data ?? [];
  const current = analyses.find((a) => a.id === selectedId) ?? analyses[0];
  useEffect(() => onLevels(current?.result.levels), [current, onLevels]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-semibold">
          <Sparkles className="size-4 text-accent" aria-hidden />
          AI-анализ
        </h2>
        {history.isLoading && <Spinner className="text-muted" />}
      </div>

      <div className="space-y-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !analyze.isPending && ai.data?.configured) {
              e.preventDefault();
              analyze.mutate();
            }
          }}
          rows={2}
          maxLength={1000}
          aria-label="Вопрос к AI"
          placeholder="Ваш вопрос (необязательно): «у меня 50 000 ₽, стоит ли брать?»"
          className="w-full resize-none rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent focus:bg-panel"
        />
        <Button
          variant="primary"
          className="w-full py-2.5"
          onClick={() => analyze.mutate()}
          disabled={analyze.isPending || !ai.data?.configured}
        >
          {analyze.isPending ? (
            <>
              <Spinner /> Анализирую — около 10 секунд…
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden />
              {current ? 'Обновить анализ' : 'Проанализировать'}
            </>
          )}
        </Button>
        {ai.data && !ai.data.configured && <p className="text-sm text-hold">AI не подключён: задайте AI_API_KEY в backend/.env.</p>}
        <ErrorText error={analyze.error} />
      </div>

      {current ? (
        <AnalysisView analysis={current} />
      ) : (
        !history.isLoading && (
          <Empty>Анализов ещё не было. AI учтёт график, отчётность, дивиденды, новости, ставку ЦБ и курс рубля.</Empty>
        )
      )}

      {analyses.length > 1 && (
        <div className="border-t border-line pt-3">
          <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Предыдущие анализы</h3>
          <ul className="space-y-0.5">
            {analyses.map((a) => (
              <li key={a.id} className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedId(a.id)}
                  className={`flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-panel-2 ${
                    a.id === current?.id ? 'bg-panel-2' : ''
                  }`}
                >
                  <SignalBadge signal={a.signal} confidence={a.confidence} />
                  <span className="whitespace-nowrap text-xs text-muted">{dateTime(a.createdAt)}</span>
                  {a.question && <span className="w-full truncate text-xs text-muted">«{a.question}»</span>}
                </button>
                <button
                  onClick={() => confirm('Удалить этот анализ?') && remove.mutate(a.id)}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-down/10 hover:text-down"
                  aria-label="Удалить анализ"
                  title="Удалить"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type Tab = 'ai' | 'trade' | 'indicators' | 'company' | 'news';

export function Instrument() {
  const secid = useParams().secid!.toUpperCase();
  const qc = useQueryClient();
  const wide = useWide();
  const [tab, setTab] = useState<Tab>('indicators');
  const [levels, setLevels] = useState<{ support: number[]; resistance: number[] }>();

  const quote = useQuery({ queryKey: ['quote', secid], queryFn: () => api.quote(secid), refetchInterval: 30_000 });
  const indicators = useQuery({ queryKey: ['indicators', secid], queryFn: () => api.indicators(secid) });
  const watchlist = useQuery({ queryKey: ['watchlist'], queryFn: api.watchlist });

  const inWatchlist = watchlist.data?.some((w) => w.secid === secid) ?? false;
  const toggleWatch = useMutation({
    mutationFn: () => (inWatchlist ? api.unwatch(secid) : api.watch(secid)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  // AI and trading are tabs only on narrow screens; on wide ones they sit in the right panel.
  const tabs: { id: Tab; label: string }[] = [
    ...(wide
      ? []
      : [
          { id: 'ai' as const, label: 'AI-анализ' },
          { id: 'trade' as const, label: 'Сделка' },
        ]),
    { id: 'indicators', label: 'Индикаторы' },
    { id: 'company', label: 'Отчётность и дивиденды' },
    { id: 'news', label: 'Новости' },
  ];
  const activeTab = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
  useEffect(() => setTab(wide ? 'indicators' : 'ai'), [wide, secid]);

  const q = quote.data;
  if (quote.error) {
    return (
      <div className="p-6">
        <ErrorText error={quote.error} />
        <Link to="/market" className="mt-2 inline-block text-sm text-accent">
          Открыть список компаний
        </Link>
      </div>
    );
  }

  const change = q?.changePct ?? 0;

  return (
    <div className="flex min-h-full flex-col xl:h-full xl:flex-row">
      <section className="flex min-w-0 flex-1 flex-col xl:overflow-y-auto">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-panel px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{secid}</h1>
              <span className="truncate text-muted">{q?.shortname}</span>
            </div>
            <p className="truncate text-xs text-muted">{q?.name}</p>
          </div>
          {q && (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight">{price(q.price, q.decimals)} ₽</span>
              <span
                className={`rounded-full px-2 py-0.5 text-sm font-semibold ${
                  change > 0 ? 'bg-up/12 text-up' : change < 0 ? 'bg-down/12 text-down' : 'bg-panel-2 text-muted'
                }`}
              >
                {pct(change)}
              </span>
            </div>
          )}
          <Button className="ml-auto" onClick={() => toggleWatch.mutate()} disabled={toggleWatch.isPending || !watchlist.data}>
            <Star className={`size-4 ${inWatchlist ? 'fill-current text-hold' : ''}`} aria-hidden />
            <span className="hidden sm:inline">{inWatchlist ? 'В вотчлисте' : 'В вотчлист'}</span>
          </Button>
        </div>

        <div className="border-b border-line bg-panel px-4 pt-3 pb-2">
          <PriceChart secid={secid} levels={levels} heightClass="h-72 sm:h-[420px] xl:h-[46vh]" />
        </div>

        <div className="flex-1 bg-panel">
          <div className="flex gap-1 overflow-x-auto border-b border-line px-3" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition ${
                  activeTab === t.id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-fg'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="p-4">
            {activeTab === 'ai' && <AiPanel secid={secid} onLevels={setLevels} />}
            {activeTab === 'trade' && <TradePanel secid={secid} plain />}
            {activeTab === 'indicators' && (
              <>
                <ErrorText error={indicators.error} />
                {indicators.isLoading && <Spinner className="text-muted" />}
                {indicators.data && <IndicatorsGrid ind={indicators.data} />}
              </>
            )}
            {activeTab === 'company' && <CompanyCard secid={secid} plain />}
            {activeTab === 'news' && <NewsCard secid={secid} title="Новости компании" plain />}
          </div>
        </div>
      </section>

      {wide && (
        <aside className="flex w-[400px] shrink-0 flex-col overflow-y-auto border-l border-line bg-panel" aria-label="AI и сделки">
          <div className="p-4">
            <AiPanel secid={secid} onLevels={setLevels} />
          </div>
          <div className="mt-auto border-t border-line p-4">
            <h2 className="mb-3 font-semibold">Купить / продать</h2>
            <TradePanel secid={secid} plain />
          </div>
        </aside>
      )}
    </div>
  );
}
