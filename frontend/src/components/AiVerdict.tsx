import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, ChevronDown, MessageCircleQuestion, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type Analysis } from '../api';
import { dateTime, price } from '../format';
import { Button, ConfidenceRing, ErrorText, SIGNAL_META, SimpleBox, Skeleton, Spinner } from './ui';

const HORIZON: Record<Analysis['result']['horizon'], string> = {
  days: 'на несколько дней',
  weeks: 'на несколько недель',
  months: 'на несколько месяцев',
};

function Points({ title, items, tone, Icon }: { title: string; items: string[]; tone: string; Icon: typeof ArrowUpRight }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className={`mb-2 flex items-center gap-1.5 text-sm font-semibold ${tone}`}>
        <Icon className="size-4" strokeWidth={2.25} aria-hidden />
        {title}
      </h4>
      <ul className="space-y-2">
        {items.map((t, i) => (
          <li key={i} className="text-sm leading-relaxed text-ink-2">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

type Levels = { support: number[]; resistance: number[] };

export function AiVerdict({ secid, onLevels }: { secid: string; onLevels: (l?: Levels) => void }) {
  const qc = useQueryClient();
  const [question, setQuestion] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
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
      setOpen(!!a.question);
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

  const list = history.data ?? [];
  const a = list.find((x) => x.id === selectedId) ?? list[0];
  useEffect(() => {
    if (a) onLevels(a.result.levels);
  }, [a, onLevels]);
  const r = a?.result;
  const meta = a ? SIGNAL_META[a.signal] : null;

  return (
    <section className="ai-frame rounded-[18px] p-5 shadow-soft md:p-5">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="mr-auto">
          <h2 className="text-lg font-semibold tracking-tight">AI-вердикт</h2>
          <p className="text-sm text-muted">
            {a ? `${dateTime(a.createdAt)} · по цене ${price(a.price)} ₽` : 'График, отчётность, дивиденды, новости, ставка ЦБ и рубль'}
          </p>
        </div>
        {list.length > 1 && (
          <select
            value={a?.id}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            aria-label="Предыдущие анализы"
            className="h-9 rounded-full border border-line bg-surface px-3 text-sm text-ink-2"
          >
            {list.map((x) => (
              <option key={x.id} value={x.id}>
                {dateTime(x.createdAt)} · {SIGNAL_META[x.signal].label}
              </option>
            ))}
          </select>
        )}
      </div>

      {history.isLoading && <Skeleton className="h-32" />}

      {a && r && meta && (
        <div className="space-y-5">
          <div className="flex items-center gap-5">
            <ConfidenceRing value={a.confidence} signal={a.signal} />
            <div className="min-w-0">
              <div className={`text-xl font-semibold tracking-tight md:text-2xl ${meta.tone}`}>{meta.verdict}</div>
              <div className="mt-1 text-sm text-muted">Горизонт — {HORIZON[r.horizon]}</div>
            </div>
          </div>

          <p className="text-[15px] leading-relaxed text-ink">{r.summary}</p>
          <SimpleBox text={r.simple} />

          {a.question && r.answer && (
            <div className="rounded-2xl border border-line p-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                <MessageCircleQuestion className="size-3.5" aria-hidden />
                {a.question}
              </div>
              <p className="text-sm leading-relaxed">{r.answer}</p>
            </div>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm font-semibold"
            aria-expanded={open}
          >
            Аргументы, риски и уровни
            <ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>

          {open && (
            <div className="animate-rise space-y-5">
              {(r.bull || r.bear) && (
                <div className="grid gap-3 md:grid-cols-2">
                  {r.bull && (
                    <div className="rounded-2xl bg-up/8 p-4">
                      <div className="mb-1 text-xs font-semibold text-up">Бык — за покупку</div>
                      <p className="text-sm leading-relaxed text-ink-2">{r.bull}</p>
                    </div>
                  )}
                  {r.bear && (
                    <div className="rounded-2xl bg-down/8 p-4">
                      <div className="mb-1 text-xs font-semibold text-down">Медведь — против</div>
                      <p className="text-sm leading-relaxed text-ink-2">{r.bear}</p>
                    </div>
                  )}
                  {r.verdictReason && (
                    <p className="text-sm text-ink md:col-span-2">
                      <span className="font-semibold">Решение судьи. </span>
                      {r.verdictReason}
                    </p>
                  )}
                </div>
              )}
              <div className="grid gap-5 md:grid-cols-2">
                <Points title="За рост" items={r.bullish} tone="text-up" Icon={ArrowUpRight} />
                <Points title="За падение" items={r.bearish} tone="text-down" Icon={ArrowDownRight} />
              </div>
              <Points title="Риски и что проверить" items={r.risks} tone="text-hold" Icon={ShieldAlert} />
              {(r.levels.support.length > 0 || r.levels.resistance.length > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-up/8 p-3">
                    <div className="text-xs font-semibold text-up">Поддержка</div>
                    <div className="mt-1 text-sm font-medium">{r.levels.support.map((v) => price(v)).join(' · ') || '—'}</div>
                  </div>
                  <div className="rounded-2xl bg-down/8 p-3">
                    <div className="text-xs font-semibold text-down">Сопротивление</div>
                    <div className="mt-1 text-sm font-medium">{r.levels.resistance.map((v) => price(v)).join(' · ') || '—'}</div>
                  </div>
                </div>
              )}
              {r.plan && (
                <p className="rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed text-ink-2">
                  <span className="font-semibold text-ink">Когда пересмотреть. </span>
                  {r.plan}
                </p>
              )}
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => confirm('Удалить этот анализ?') && remove.mutate(a.id)}>
                  <Trash2 className="size-3.5" aria-hidden />
                  Удалить анализ
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {!history.isLoading && !a && (
        <p className="mb-2 text-sm leading-relaxed text-ink-2">
          Получите взвешенный разбор: стоит ли присматриваться к покупке, держать или лучше обойти — и почему. Можно задать свой
          вопрос, например про конкретную сумму.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !analyze.isPending && ai.data?.configured && analyze.mutate()}
          maxLength={1000}
          aria-label="Вопрос к AI"
          placeholder="Ваш вопрос: «у меня 50 000 ₽, стоит ли брать?»"
          className="h-11 flex-1 rounded-full border border-line bg-surface px-4 text-sm outline-none placeholder:text-muted focus:border-accent"
        />
        <Button variant="ai" size="md" className="h-11" onClick={() => analyze.mutate()} disabled={analyze.isPending || !ai.data?.configured}>
          {analyze.isPending ? (
            <>
              <Spinner /> Анализирую…
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden />
              {a ? 'Обновить' : 'Получить вердикт'}
            </>
          )}
        </Button>
      </div>
      {ai.data && !ai.data.configured && <p className="mt-2 text-sm text-hold">AI не подключён: задайте AI_API_KEY в backend/.env.</p>}
      <div className="mt-2">
        <ErrorText error={analyze.error} />
      </div>
    </section>
  );
}
