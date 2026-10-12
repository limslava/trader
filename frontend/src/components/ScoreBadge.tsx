import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { Pillar, Score } from '../api';

export const SCORE_META = {
  strong: { label: 'Сильная', tone: 'text-up', bar: 'bg-up' },
  neutral: { label: 'Нейтральная', tone: 'text-hold', bar: 'bg-hold' },
  weak: { label: 'Слабая', tone: 'text-down', bar: 'bg-down' },
} as const;

export function ScoreChip({ score, size = 'sm' }: { score: Score; size?: 'sm' | 'md' }) {
  const m = SCORE_META[score.label];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-surface-2 font-semibold whitespace-nowrap ${size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'} ${m.tone}`}>
      <span className={`size-1.5 rounded-full ${m.bar}`} aria-hidden />
      {score.total} · {m.label}
    </span>
  );
}

function PillarRow({ name, p, weight }: { name: string; p: Pillar | null; weight: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span>
          {name} <span className="text-xs text-muted">· вес {weight}</span>
        </span>
        <span className="font-semibold">{p ? p.score : '—'}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        {p && <div className={`h-full rounded-full ${p.score >= 65 ? 'bg-up' : p.score <= 40 ? 'bg-down' : 'bg-hold'}`} style={{ width: `${p.score}%` }} />}
      </div>
      {p && (
        <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
          {p.drivers.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Full breakdown of the deterministic score: three pillars with their drivers. */
export function ScoreBreakdown({ score }: { score: Score }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left" aria-expanded={open}>
        <span className="flex items-center gap-2">
          <ScoreChip score={score} size="md" />
          <span className="text-sm text-muted">количественная оценка</span>
        </span>
        <ChevronDown className={`size-4 text-muted transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <PillarRow name="Тренд и импульс" p={score.tech} weight={score.fundamental ? '45%' : '65%'} />
          <PillarRow name="Сила относительно индекса" p={score.relative} weight={score.fundamental ? '25%' : '35%'} />
          <PillarRow name="Фундаментал" p={score.fundamental} weight={score.fundamental ? '30%' : '—'} />
        </div>
      )}
    </div>
  );
}
