import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api';
import { AnalysisView } from '../components/AnalysisView';
import { IndicatorsGrid } from '../components/IndicatorsGrid';
import { NewsCard } from '../components/NewsList';
import { PriceChart } from '../components/PriceChart';
import { Button, Card, Empty, ErrorText, SignalBadge, Spinner } from '../components/ui';
import { changeColor, dateTime, pct, price } from '../format';

export function Instrument() {
  const secid = useParams().secid!.toUpperCase();
  const qc = useQueryClient();
  const [question, setQuestion] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const quote = useQuery({ queryKey: ['quote', secid], queryFn: () => api.quote(secid), refetchInterval: 30_000 });
  const indicators = useQuery({ queryKey: ['indicators', secid], queryFn: () => api.indicators(secid) });
  const watchlist = useQuery({ queryKey: ['watchlist'], queryFn: api.watchlist });
  const history = useQuery({ queryKey: ['analyses', secid], queryFn: () => api.analyses(secid) });
  const ai = useQuery({ queryKey: ['aiStatus'], queryFn: api.aiStatus, staleTime: Infinity });

  const inWatchlist = watchlist.data?.some((w) => w.secid === secid) ?? false;
  const toggleWatch = useMutation({
    mutationFn: () => (inWatchlist ? api.unwatch(secid) : api.watch(secid)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const analyze = useMutation({
    mutationFn: () => api.analyze(secid, question.trim() || undefined),
    onSuccess: (a) => {
      setQuestion('');
      setSelectedId(a.id);
      qc.invalidateQueries({ queryKey: ['analyses'] });
      qc.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteAnalysis(id),
    onSuccess: () => {
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ['analyses'] });
      qc.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  const analyses = history.data ?? [];
  const current = analyses.find((a) => a.id === selectedId) ?? analyses[0];
  const q = quote.data;

  if (quote.error) {
    return (
      <Card>
        <ErrorText error={quote.error} />
        <Link to="/" className="mt-2 inline-block text-sm text-accent">
          ← К вотчлисту
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <h1 className="text-2xl font-semibold">
            {secid} <span className="text-lg font-normal text-muted">{q?.shortname}</span>
          </h1>
          <p className="text-sm text-muted">{q?.name}</p>
        </div>
        {q && (
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-semibold">{price(q.price, q.decimals)} ₽</span>
            <span className={changeColor(q.changePct)}>{pct(q.changePct)}</span>
            {q.updateTime && <span className="text-xs text-muted">{q.updateTime} МСК</span>}
          </div>
        )}
        <Button className="ml-auto" onClick={() => toggleWatch.mutate()} disabled={toggleWatch.isPending || !watchlist.data}>
          {inWatchlist ? '★ В вотчлисте' : '☆ В вотчлист'}
        </Button>
      </div>

      <Card>
        <PriceChart secid={secid} levels={current?.result.levels} />
      </Card>

      <Card title="Индикаторы (дневные)" actions={indicators.isLoading ? <Spinner className="text-muted" /> : null}>
        <ErrorText error={indicators.error} />
        {indicators.data && <IndicatorsGrid ind={indicators.data} />}
      </Card>

      <Card title="AI-анализ">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !analyze.isPending && ai.data?.configured && analyze.mutate()}
            maxLength={1000}
            placeholder="Свой вопрос к AI (необязательно), например: стоит ли докупать на текущих?"
            className="flex-1 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
          />
          <Button variant="primary" onClick={() => analyze.mutate()} disabled={analyze.isPending || !ai.data?.configured}>
            {analyze.isPending ? (
              <>
                <Spinner /> Анализирую…
              </>
            ) : (
              'Проанализировать'
            )}
          </Button>
        </div>
        {ai.data && !ai.data.configured && (
          <p className="mb-4 text-sm text-hold">AI не подключён: задайте AI_API_KEY в backend/.env.</p>
        )}
        <ErrorText error={analyze.error} />

        {current ? (
          <AnalysisView analysis={current} />
        ) : (
          !history.isLoading && <Empty>Анализов по этой бумаге ещё не было.</Empty>
        )}

        {analyses.length > 1 && (
          <div className="mt-6 border-t border-line pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Предыдущие анализы</h3>
            <ul className="space-y-1">
              {analyses.map((a) => (
                <li key={a.id} className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedId(a.id)}
                    className={`flex flex-1 items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-panel-2 ${a.id === current?.id ? 'bg-panel-2' : ''}`}
                  >
                    <SignalBadge signal={a.signal} confidence={a.confidence} />
                    <span className="text-muted">{dateTime(a.createdAt)}</span>
                    <span className="text-muted">@ {price(a.price)}</span>
                    {a.question && <span className="truncate text-xs text-muted">«{a.question}»</span>}
                  </button>
                  <button
                    onClick={() => confirm('Удалить этот анализ?') && remove.mutate(a.id)}
                    className="text-xs text-muted hover:text-down"
                    title="Удалить"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <NewsCard secid={secid} title="Новости компании" />
    </div>
  );
}
