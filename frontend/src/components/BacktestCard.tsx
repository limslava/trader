import { useQuery } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';
import { pct } from '../format';
import { ErrorText, Segmented, Skeleton, Surface } from './ui';

/**
 * Honest check of the technical score: walk-forward over the last year on index members.
 * The verdict is written in plain words because "spread −0.1%" means nothing to a beginner.
 */
export function BacktestCard() {
  const [h, setH] = useState<10 | 20 | 60>(20);
  const { data, isLoading, error } = useQuery({ queryKey: ['backtest', h], queryFn: () => api.backtest(h), staleTime: 60 * 60_000 });
  const d = data;
  const edge = d?.spreadPct ?? 0;
  const hit = d?.strong.hitRatePct ?? 0;
  const verdict =
    !d ? null
    : edge > 1 && hit > 55 ? { text: 'Есть преимущество: бумаги с высоким счётом росли чаще и сильнее, чем со слабым.', tone: 'text-up' }
    : edge < -0.5 ? { text: 'Преимущества нет — скорее наоборот: сильно выросшие бумаги в этот период чаще откатывались. Тренд сейчас описывает прошлое, а не предсказывает будущее.', tone: 'text-down' }
    : { text: 'Преимущества не обнаружено: высокий счёт не предсказывал рост. Используйте оценку как описание картины, не как прогноз.', tone: 'text-hold' };

  return (
    <Surface className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <FlaskConical className="size-5 text-muted" aria-hidden />
        <div className="mr-auto">
          <h2 className="text-base font-semibold tracking-tight">Проверка оценки на истории</h2>
          <p className="text-sm text-muted">Техническая часть счёта, бумаги индекса, последний год, без заглядывания в будущее</p>
        </div>
        <Segmented
          size="sm"
          value={String(h) as '10' | '20' | '60'}
          onChange={(v) => setH(Number(v) as 10 | 20 | 60)}
          options={[
            { value: '10', label: '10 дней' },
            { value: '20', label: '20 дней' },
            { value: '60', label: '60 дней' },
          ]}
        />
      </div>
      <ErrorText error={error} />
      {isLoading && <Skeleton className="h-24" />}
      {d && verdict && (
        <>
          <p className={`text-sm font-semibold ${verdict.tone}`}>{verdict.text}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted">«Сильные» выросли</div>
              <div className="font-semibold">{d.strong.hitRatePct ?? '—'}% случаев</div>
              <div className="text-xs text-muted">в среднем {pct(d.strong.meanReturnPct)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">«Слабые» упали</div>
              <div className="font-semibold">{d.weak.hitRatePct ?? '—'}% случаев</div>
              <div className="text-xs text-muted">в среднем {pct(d.weak.meanReturnPct)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Сильные минус слабые</div>
              <div className={`font-semibold ${edge > 0 ? 'text-up' : 'text-down'}`}>{pct(d.spreadPct)}</div>
              <div className="text-xs text-muted">лучше в {d.spreadWinRatePct ?? '—'}% дат</div>
            </div>
            <div>
              <div className="text-xs text-muted">Выборка</div>
              <div className="font-semibold">{d.observations}</div>
              <div className="text-xs text-muted">{d.dates} дат × бумаги</div>
            </div>
          </div>
        </>
      )}
    </Surface>
  );
}
