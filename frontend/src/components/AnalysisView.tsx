import type { Analysis } from '../api';
import { dateTime, price } from '../format';
import { SignalBadge, SimpleBox } from './ui';

const HORIZON: Record<Analysis['result']['horizon'], string> = {
  days: 'несколько дней',
  weeks: 'несколько недель',
  months: 'несколько месяцев',
};

function List({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${color}`}>{title}</h3>
      <ul className="space-y-1 text-sm text-fg-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className={color}>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnalysisView({ analysis }: { analysis: Analysis }) {
  const r = analysis.result;
  return (
    <div className="@container space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <SignalBadge signal={r.signal} confidence={r.confidence} size="lg" />
        <span className="text-sm text-muted">горизонт: {HORIZON[r.horizon]}</span>
        <span className="text-xs text-muted @lg:ml-auto">
          {dateTime(analysis.createdAt)} · цена {price(analysis.price)} · {analysis.model}
        </span>
      </div>

      <SimpleBox text={r.simple} />
      <p className="text-[15px] leading-relaxed text-fg">{r.summary}</p>
      {r.trend && <p className="text-sm text-fg-2">{r.trend}</p>}

      {analysis.question && (
        <div className="rounded-lg border border-line bg-panel-2 p-3">
          <p className="text-xs text-muted">Вопрос: {analysis.question}</p>
          {r.answer && <p className="mt-1.5 text-sm text-fg">{r.answer}</p>}
        </div>
      )}

      <div className="grid gap-5 @3xl:grid-cols-3">
        <List title="За рост" items={r.bullish} color="text-up" />
        <List title="За падение" items={r.bearish} color="text-down" />
        <List title="Риски" items={r.risks} color="text-hold" />
      </div>

      {(r.levels.support.length > 0 || r.levels.resistance.length > 0) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <span className="text-muted">Поддержка: </span>
            <span className="text-up">{r.levels.support.map((v) => price(v)).join(' · ') || '—'}</span>
          </span>
          <span>
            <span className="text-muted">Сопротивление: </span>
            <span className="text-down">{r.levels.resistance.map((v) => price(v)).join(' · ') || '—'}</span>
          </span>
        </div>
      )}

      {r.plan && (
        <p className="border-l-2 border-accent pl-3 text-sm text-fg-2">
          <span className="text-muted">Когда пересмотреть: </span>
          {r.plan}
        </p>
      )}
    </div>
  );
}
