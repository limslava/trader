import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, type ReviewPick, type ReviewScope } from '../api';
import { changeColor, dateTime, pct, price } from '../format';
import { Button, Card, Empty, ErrorText, SignalBadge, SimpleBox, Spinner } from './ui';

function Picks({ title, picks, color }: { title: string; picks: ReviewPick[]; color: string }) {
  if (picks.length === 0) return null;
  return (
    <div>
      <h3 className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${color}`}>{title}</h3>
      <ul className="space-y-1.5 text-sm">
        {picks.map((p) => (
          <li key={p.secid}>
            <Link to={`/s/${p.secid}`} className={`font-semibold ${color} hover:underline`}>
              {p.secid}
            </Link>
            <span className="text-slate-300"> — {p.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const COPY: Record<ReviewScope, { title: string; empty: string; running: string }> = {
  watchlist: {
    title: 'AI-обзор вотчлиста',
    empty: 'AI сравнит все бумаги вотчлиста и подскажет, какие сейчас сильнее, а какие слабее.',
    running: 'Анализирую вотчлист…',
  },
  imoex: {
    title: 'AI-обзор рынка: 44 крупнейшие компании',
    empty: 'AI разберёт все бумаги индекса Мосбиржи с учётом ставки ЦБ и курса рубля: что происходит на рынке, кто сильнее, кого лучше обойти. Занимает около 30 секунд.',
    running: 'Анализирую рынок, ~30 сек…',
  },
};

const COLLAPSED_ITEMS = 10;

type Props = { scope: ReviewScope; canRun: boolean; count: number };

export function ReviewCard({ scope, canRun, count }: Props) {
  const qc = useQueryClient();
  const copy = COPY[scope];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const reviews = useQuery({ queryKey: ['reviews', scope], queryFn: () => api.reviews(scope) });

  const create = useMutation({
    mutationFn: () => api.createReview(scope),
    onSuccess: (r) => {
      setSelectedId(r.id);
      qc.invalidateQueries({ queryKey: ['reviews', scope] });
    },
  });
  const remove = useMutation({
    mutationFn: api.deleteReview,
    onSuccess: () => {
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ['reviews', scope] });
    },
  });

  const list = reviews.data ?? [];
  const review = list.find((r) => r.id === selectedId) ?? list[0];
  const snap = new Map(review?.snapshot.map((s) => [s.secid, s]));

  return (
    <Card
      title={copy.title}
      actions={
        <div className="flex items-center gap-2">
          {list.length > 1 && (
            <select
              value={review?.id}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="rounded-md border border-line bg-panel-2 px-2 py-1 text-xs text-slate-300"
            >
              {list.map((r) => (
                <option key={r.id} value={r.id}>
                  {dateTime(r.createdAt)}
                </option>
              ))}
            </select>
          )}
          <Button variant="primary" onClick={() => create.mutate()} disabled={!canRun || count === 0 || create.isPending}>
            {create.isPending ? (
              <>
                <Spinner /> {copy.running}
              </>
            ) : (
              'Сделать обзор'
            )}
          </Button>
        </div>
      }
    >
      <ErrorText error={create.error ?? reviews.error} />
      {!review && !reviews.isLoading && (
        <Empty>
          {count === 0 && scope === 'watchlist' ? 'Добавьте бумаги в вотчлист, чтобы получить обзор.' : copy.empty}
        </Empty>
      )}

      {review && (
        <div className="space-y-5">
          <SimpleBox text={review.result.simple} />
          <div>
            <p className="text-[15px] leading-relaxed text-slate-100">{review.result.summary}</p>
            {review.result.market && <p className="mt-2 text-sm text-slate-400">{review.result.market}</p>}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Picks title="Интереснее всего" picks={review.result.top} color="text-up" />
            <Picks title="Слабее всего" picks={review.result.avoid} color="text-down" />
          </div>

          <ul className="divide-y divide-line rounded-lg border border-line">
            {(expanded ? review.result.items : review.result.items.slice(0, COLLAPSED_ITEMS)).map((item) => {
              const s = snap.get(item.secid);
              return (
                <li key={item.secid} className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-start sm:gap-4">
                  <div className="flex shrink-0 items-center gap-3 sm:w-80">
                    <Link to={`/s/${item.secid}`} className="w-14 font-semibold hover:underline">
                      {item.secid}
                    </Link>
                    <SignalBadge signal={item.signal} confidence={item.confidence} />
                    {s && (
                      <span className="whitespace-nowrap text-xs text-muted">
                        {price(s.price)} <span className={changeColor(s.indicators.change1mPct)}>{pct(s.indicators.change1mPct)} 1м</span>
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-300">{item.comment}</p>
                </li>
              );
            })}
          </ul>
          {review.result.items.length > COLLAPSED_ITEMS && (
            <button onClick={() => setExpanded((v) => !v)} className="-mt-3 text-sm text-accent hover:underline">
              {expanded ? 'Свернуть' : `Показать все (${review.result.items.length})`}
            </button>
          )}

          {review.result.risks.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-hold">Риски</h3>
              <ul className="space-y-1 text-sm text-slate-300">
                {review.result.risks.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-hold">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              {dateTime(review.createdAt)} · {review.model} · бумаг: {review.secids.length}
            </span>
            <button onClick={() => confirm('Удалить этот обзор?') && remove.mutate(review.id)} className="hover:text-down">
              Удалить
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
