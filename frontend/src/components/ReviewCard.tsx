import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, type ReviewPick, type ReviewScope } from '../api';
import { dateTime } from '../format';
import { Button, Empty, ErrorText, Monogram, SignalBadge, SimpleBox, Spinner } from './ui';

const COPY: Record<ReviewScope, { title: string; empty: string; running: string }> = {
  watchlist: {
    title: 'AI-обзор вотчлиста',
    empty: 'AI сравнит все бумаги вашего вотчлиста: какие сейчас сильнее, какие слабее и почему.',
    running: 'Сравниваю бумаги…',
  },
  imoex: {
    title: 'AI-обзор рынка',
    empty:
      'AI разберёт 44 крупнейшие компании с учётом ставки ЦБ, курса рубля, отчётности и новостей: что происходит на рынке, кто сильнее, кого лучше обойти. Около 30 секунд.',
    running: 'Анализирую рынок, ~30 сек…',
  },
};

function Picks({ title, picks, tone }: { title: string; picks: ReviewPick[]; tone: 'up' | 'down' }) {
  if (picks.length === 0) return null;
  const Icon = tone === 'up' ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <h3 className={`mb-3 flex items-center gap-1.5 text-sm font-semibold ${tone === 'up' ? 'text-up' : 'text-down'}`}>
        <Icon className="size-4" strokeWidth={2.5} aria-hidden />
        {title}
      </h3>
      <ul className="space-y-3">
        {picks.map((p) => (
          <li key={p.secid}>
            <Link to={`/s/${p.secid}`} className="group flex gap-3">
              <Monogram secid={p.secid} size="sm" />
              <span className="min-w-0 text-sm leading-snug">
                <span className="font-semibold group-hover:underline">{p.secid}</span>
                <span className="block text-ink-2">{p.reason}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const COLLAPSED = 6;

export function ReviewCard({ scope, canRun, count }: { scope: ReviewScope; canRun: boolean; count: number }) {
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
  const items = review ? (expanded ? review.result.items : review.result.items.slice(0, COLLAPSED)) : [];

  return (
    <section className="ai-frame rounded-[18px] p-5 shadow-soft md:p-5">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="mr-auto">
          <h2 className="text-lg font-semibold tracking-tight">{copy.title}</h2>
          {review && (
            <p className="text-sm text-muted">
              {dateTime(review.createdAt)} · {review.secids.length} бумаг
            </p>
          )}
        </div>
        {list.length > 1 && (
          <select
            value={review?.id}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            aria-label="Выбрать обзор"
            className="h-10 rounded-full border border-line bg-surface px-3 text-sm text-ink-2"
          >
            {list.map((r) => (
              <option key={r.id} value={r.id}>
                {dateTime(r.createdAt)}
              </option>
            ))}
          </select>
        )}
        <Button variant="ai" onClick={() => create.mutate()} disabled={!canRun || count === 0 || create.isPending}>
          {create.isPending ? (
            <>
              <Spinner /> {copy.running}
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden />
              {review ? 'Обновить' : 'Сделать обзор'}
            </>
          )}
        </Button>
      </div>

      <ErrorText error={create.error ?? reviews.error} />
      {!review && !reviews.isLoading && (
        <Empty>{count === 0 && scope === 'watchlist' ? 'Добавьте бумаги в вотчлист, чтобы получить обзор.' : copy.empty}</Empty>
      )}

      {review && (
        <div className="space-y-5">
          <p className="text-[15px] leading-relaxed text-ink">{review.result.summary}</p>
          <SimpleBox text={review.result.simple} />
          {review.result.market && <p className="text-sm leading-relaxed text-muted">{review.result.market}</p>}

          <div className="grid gap-3 md:grid-cols-2">
            <Picks title="Сильнее всего" picks={review.result.top} tone="up" />
            <Picks title="Слабее всего" picks={review.result.avoid} tone="down" />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">По каждой бумаге</h3>
            <ul className="divide-y divide-line/70">
              {items.map((it) => (
                <li key={it.secid}>
                  <Link to={`/s/${it.secid}`} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-start sm:gap-4">
                    <span className="flex w-56 shrink-0 items-center gap-2">
                      <span className="w-14 font-semibold">{it.secid}</span>
                      <SignalBadge signal={it.signal} confidence={it.confidence} />
                    </span>
                    <span className="text-sm leading-relaxed text-ink-2">{it.comment}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {review.result.items.length > COLLAPSED && (
              <button onClick={() => setExpanded((v) => !v)} className="mt-1 flex items-center gap-1 text-sm font-semibold text-accent">
                {expanded ? 'Свернуть' : `Показать все ${review.result.items.length}`}
                <ChevronDown className={`size-4 transition ${expanded ? 'rotate-180' : ''}`} aria-hidden />
              </button>
            )}
          </div>

          {review.result.risks.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Риски</h3>
              <ul className="grid gap-2 md:grid-cols-2">
                {review.result.risks.map((r, i) => (
                  <li key={i} className="rounded-xl bg-hold/8 px-3 py-2 text-sm leading-snug text-ink-2">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => confirm('Удалить этот обзор?') && remove.mutate(review.id)}>
              <Trash2 className="size-3.5" aria-hidden />
              Удалить обзор
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
