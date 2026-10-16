import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pause, Play, RotateCw, Square, Trash2, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, type Arena as ArenaData, type ArenaAgent, type ArenaGroup, type ArenaGroupKey, type ArenaRun } from '../api';
import { Office } from '../components/Office';
import { Sparkline } from '../components/Sparkline';
import { Button, Delta, Empty, ErrorText, Monogram, Segmented, Skeleton, Surface, Tabs } from '../components/ui';
import { date, dateTime, money, pct, price } from '../format';

/**
 * Arena: autonomous AI agents with different characters, each on its own sandbox account.
 * Summary strip + leaderboard on top; the selected agent's journal below (same A+B layout as the other pages).
 */

const PERSONA_TONE: Record<string, string> = {
  value: 'bg-accent/15 text-accent',
  momentum: 'bg-up/15 text-up',
  contrarian: 'bg-down/15 text-down',
  dividend: 'bg-hold/20 text-ink',
  quant: 'bg-ink/10 text-ink',
};

const modelName = (m: string | null | undefined) => (m ? m.replace(/^ollama\//, '') : '');

function Rank({ n }: { n: number }) {
  const medal = ['🥇', '🥈', '🥉'][n - 1];
  return <span className="w-7 text-center text-base">{medal ?? <span className="text-sm text-muted">{n}</span>}</span>;
}

function StatusPill({ agent }: { agent: Pick<ArenaAgent, 'status' | 'running' | 'stopReason'> }) {
  if (agent.running) return <span className="rounded-full bg-ai/15 px-2 py-0.5 text-[11px] font-semibold text-ai">думает…</span>;
  if (agent.status === 'stopped')
    return (
      <span className="rounded-full bg-down/10 px-2 py-0.5 text-[11px] font-semibold text-down" title={agent.stopReason ?? undefined}>
        стоп
      </span>
    );
  return <span className="rounded-full bg-up/10 px-2 py-0.5 text-[11px] font-semibold text-up">в игре</span>;
}

function OrderChip({ o }: { o: ArenaRun['executed'][number] }) {
  const tone = o.status === 'filled' ? (o.direction === 'buy' ? 'bg-up/10 text-up' : 'bg-down/10 text-down') : 'bg-surface-2 text-muted line-through';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`} title={o.reason}>
      {o.direction === 'buy' ? 'Купить' : 'Продать'} {o.secid}
      {o.status === 'filled' && <span className="font-normal">· {money(o.amountRub)}</span>}
    </span>
  );
}

function RunEntry({ run }: { run: ArenaRun }) {
  const [open, setOpen] = useState(false);
  const filled = run.executed.filter((o) => o.status === 'filled');
  const rejected = run.executed.filter((o) => o.status !== 'filled');
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="font-semibold text-ink">{dateTime(run.startedAt)}</span>
        {run.equityBefore != null && <span>счёт {money(run.equityBefore)}</span>}
        {run.model && <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium">{modelName(run.model)}</span>}
        {run.status === 'running' && <span className="text-ai">принимает решение…</span>}
        {run.status === 'failed' && <span className="text-down">ошибка: {run.error}</span>}
        {run.status === 'done' && filled.length === 0 && <span>без сделок</span>}
      </div>
      {run.marketView && <p className="mt-2 text-sm text-ink-2">{run.marketView}</p>}
      {run.executed.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {filled.map((o, i) => (
            <OrderChip key={`f${i}`} o={o} />
          ))}
          {rejected.map((o, i) => (
            <OrderChip key={`r${i}`} o={o} />
          ))}
        </div>
      )}
      {rejected.length > 0 && (
        <p className="mt-1.5 text-xs text-muted">
          Риск-слой отклонил: {rejected.map((o) => `${o.secid} — ${o.reason.toLowerCase()}`).join('; ')}
        </p>
      )}
      {run.reasoning && (
        <>
          <button onClick={() => setOpen((v) => !v)} className="mt-2 text-xs font-semibold text-accent hover:underline">
            {open ? 'Скрыть ход мыслей' : 'Ход мыслей'}
          </button>
          {open && <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-2">{run.reasoning}</p>}
        </>
      )}
    </li>
  );
}

function AgentPanel({ id, models, onChanged }: { id: number; models: ArenaData['models']; onChanged: () => void }) {
  const q = useQuery({ queryKey: ['arenaAgent', id], queryFn: () => api.arenaAgent(id), refetchInterval: 10_000 });
  const [tab, setTab] = useState<'journal' | 'positions' | 'style'>('journal');
  const run = useMutation({ mutationFn: () => api.arenaRunAgent(id), onSuccess: () => setTimeout(onChanged, 500) });
  const status = useMutation({ mutationFn: (s: 'stop' | 'resume') => api.arenaAgentStatus(id, s), onSuccess: onChanged });
  const setModel = useMutation({ mutationFn: (m: string | null) => api.arenaSetModel(id, m), onSuccess: onChanged });

  if (q.isLoading) return <Skeleton className="h-64 rounded-[18px]" />;
  if (q.error) return <ErrorText error={q.error} />;
  if (!q.data) return null;
  const { agent, portfolio, runs } = q.data;
  const total = portfolio?.total ?? 0;

  return (
    <Surface className="px-5 py-4 md:px-7">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`grid size-10 place-items-center rounded-2xl text-sm font-bold ${PERSONA_TONE[agent.persona] ?? 'bg-surface-2'}`}>
          {agent.name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight">{agent.name}</h2>
          <p className="text-sm text-muted">{agent.tagline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={agent.model ?? ''}
            onChange={(e) => setModel.mutate(e.target.value || null)}
            disabled={agent.running || setModel.isPending}
            aria-label="Модель агента"
            title="Какая модель принимает решения за этого агента"
            className="h-8 max-w-56 rounded-full border border-line bg-surface px-3 text-xs font-semibold outline-none"
          >
            <option value="">по умолчанию</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <StatusPill agent={agent} />
          <Button size="sm" onClick={() => run.mutate()} disabled={agent.running || agent.status !== 'active' || run.isPending} title="Принять решение прямо сейчас">
            <RotateCw className="size-3.5" aria-hidden /> Ход
          </Button>
          {agent.status === 'active' ? (
            <Button size="sm" variant="down" onClick={() => status.mutate('stop')} disabled={status.isPending}>
              <Square className="size-3.5" aria-hidden /> Стоп
            </Button>
          ) : (
            <Button size="sm" variant="up" onClick={() => status.mutate('resume')} disabled={status.isPending}>
              <Play className="size-3.5" aria-hidden /> Вернуть
            </Button>
          )}
        </div>
      </div>
      <ErrorText error={run.error ?? status.error ?? setModel.error} />
      {agent.stopReason && agent.status === 'stopped' && <p className="mt-2 text-sm text-down">{agent.stopReason}</p>}

      <div className="mt-4">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'journal', label: `Журнал решений · ${runs.length}` },
            { value: 'positions', label: `Позиции · ${portfolio?.positions.length ?? 0}` },
            { value: 'style', label: 'Характер' },
          ]}
        />
      </div>

      {tab === 'journal' &&
        (runs.length === 0 ? (
          <Empty>Решений пока нет: первый ход — в ближайшее торговое время (10:00, 13:00 или 16:00 МСК), или нажмите «Ход».</Empty>
        ) : (
          <ul className="divide-y divide-line/70">
            {runs.map((r) => (
              <RunEntry key={r.id} run={r} />
            ))}
          </ul>
        ))}

      {tab === 'positions' && (
        <div className="mt-3">
          <p className="mb-3 text-sm text-muted">
            Деньги: <span className="font-semibold text-ink">{money(portfolio?.availableCash)}</span>
            {total > 0 && <> · {pct(((portfolio?.cash ?? 0) / total) * 100).replace('+', '')} счёта</>}
          </p>
          {portfolio && portfolio.positions.length > 0 ? (
            <ul className="divide-y divide-line/70">
              {portfolio.positions.map((p) => (
                <li key={p.secid} className="flex items-center gap-3 py-3">
                  <Monogram secid={p.secid} size="sm" />
                  <Link to={`/s/${p.secid}`} className="min-w-0 flex-1 hover:underline">
                    <span className="block truncate text-sm font-semibold">{p.name || p.secid}</span>
                    <span className="text-xs text-muted">
                      {p.quantity} шт · {total > 0 ? `${(((p.value ?? 0) / total) * 100).toFixed(1)}%` : ''}
                    </span>
                  </Link>
                  <span className="text-right">
                    <span className="block text-sm font-semibold">{money(p.value)}</span>
                    <span className="text-xs">
                      <Delta value={p.expectedYield != null && p.value ? (p.expectedYield / (p.value - p.expectedYield)) * 100 : null} size="sm" />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Пока только деньги.</Empty>
          )}
        </div>
      )}

      {tab === 'style' && <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">{agent.style}</p>}
    </Surface>
  );
}

const GROUP_INTRO: Record<ArenaGroupKey, { title: string; text: string; plan: (models: number, personas: number) => string }> = {
  main: {
    title: 'Основной турнир',
    text: 'Пять агентов с разными характерами получают по одинаковому виртуальному счёту и три раза в день по будням (10:00, 13:00 и 16:00 МСК) сами решают, что купить или продать. Сделки исполняются по живой цене биржи с комиссией 0,05%. Модель только предлагает сделки, а жёсткие лимиты (не больше 10% счёта в одной бумаге, 12 сделок в неделю, стоп при просадке 15%, без плеча и шортов) проверяет код.',
    plan: () => '5 агентов: по одному на характер, модель у каждого можно менять',
  },
  models: {
    title: 'Турнир моделей',
    text: 'Один и тот же нейтральный характер «Инвестор» на каждой доступной модели. Характер уравнен, поэтому разница в результатах — это разница между моделями.',
    plan: (m) => `${m} агентов: по одному на модель`,
  },
  styles: {
    title: 'Турнир стилей',
    text: 'Каждый характер на каждой модели. Видно, какой стиль выживает независимо от того, кто думает, и какая модель лучше играет каждый стиль.',
    plan: (m, p) => `${p} × ${m} = ${p * m} агентов; раунд с локальными моделями займёт около ${Math.ceil((p * m * 3) / 60 * 10) / 10} ч`,
  },
};

function SetupCard({ group, data }: { group: ArenaGroupKey; data: ArenaData }) {
  const qc = useQueryClient();
  const [capital, setCapital] = useState('100000');
  const setup = useMutation({ mutationFn: (n: number) => api.arenaSetup(group, n), onSuccess: () => qc.invalidateQueries({ queryKey: ['arena'] }) });
  const intro = GROUP_INTRO[group];
  const personas = group === 'models' ? data.personas.filter((p) => p.key === 'neutral') : data.personas.filter((p) => p.key !== 'neutral');
  const localCount = data.models.filter((m) => m.local).length;
  return (
    <Surface className="p-6">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
          <Trophy className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{intro.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{intro.text}</p>
          <p className="mt-2 text-sm font-medium">{intro.plan(data.models.length, personas.length)}</p>
        </div>
      </div>
      <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {personas.map((p) => (
          <li key={p.key} className="rounded-2xl bg-surface-2 p-3">
            <span className={`inline-grid size-8 place-items-center rounded-xl text-sm font-bold ${PERSONA_TONE[p.key] ?? 'bg-surface'}`}>{p.name.slice(0, 1)}</span>
            <p className="mt-2 text-sm font-semibold">{p.name}</p>
            <p className="text-xs text-muted">{p.tagline}</p>
          </li>
        ))}
      </ul>
      {group !== 'main' && (
        <p className="mt-3 text-xs text-muted">
          Модели: {data.models.map((m) => modelName(m.id)).join(', ')}
          {localCount > 0 && ` · локальные ходят 3–5 минут каждая`}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(capital.replace(/\s/g, ''));
          if (n >= 10_000) setup.mutate(n);
        }}
        className="mt-5 flex flex-wrap items-center gap-2"
      >
        <label className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-5">
          <span className="text-sm text-muted">Каждому</span>
          <input value={capital} onChange={(e) => setCapital(e.target.value)} inputMode="numeric" aria-label="Стартовый капитал, ₽" className="w-28 bg-transparent text-lg font-semibold outline-none" />
          <span className="text-muted">₽</span>
        </label>
        <Button type="submit" variant="primary" size="lg" disabled={setup.isPending || (group !== 'main' && data.models.length < 2)}>
          {setup.isPending ? 'Открываем счета…' : 'Создать турнир'}
        </Button>
      </form>
      <ErrorText error={setup.error} />
    </Surface>
  );
}

function GroupView({ group, data, selected, onSelect }: { group: ArenaGroup; data: ArenaData; selected?: number; onSelect: (id: number) => void }) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['arena'] });
    qc.invalidateQueries({ queryKey: ['arenaAgent'] });
  };
  const teardown = useMutation({ mutationFn: () => api.arenaTeardown(group.key), onSuccess: refresh });
  const current = group.agents.some((x) => x.id === selected) ? selected! : group.agents[0].id;
  const leader = group.agents[0];

  return (
    <div className="space-y-5">
      <Surface className="px-4 py-4 md:px-7">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold tracking-tight">
              {group.title}: идёт с {date(group.since)}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {group.description} Лидер — {leader.name} ({pct(leader.returnPct)}).
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => window.confirm(`Закрыть счета всех агентов турнира «${group.title}» и удалить их журнал? Это нельзя отменить.`) && teardown.mutate()}
            disabled={teardown.isPending}
            title="Закрыть счета агентов и удалить турнир"
            className="shrink-0"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
        <div className="mt-3 flex gap-6 text-sm">
          <span>
            <span className="block text-xs text-muted">Индекс Мосбиржи</span>
            <Delta value={group.benchmarks.imoexPct} />
          </span>
          <span>
            <span className="block text-xs text-muted">ОФЗ (1 год)</span>
            <Delta value={group.benchmarks.ofzPct} />
          </span>
        </div>
        <ErrorText error={teardown.error} />
      </Surface>

      {/* Phones: one card per agent; the wide table below is for tablets and desktops. */}
      <Surface className="divide-y divide-line/70 md:hidden">
        {group.agents.map((ag, i) => (
          <button
            key={ag.id}
            type="button"
            onClick={() => onSelect(ag.id)}
            className={`flex w-full items-center gap-3 px-4 py-3 text-left ${current === ag.id ? 'bg-accent/5' : ''}`}
          >
            <Rank n={i + 1} />
            <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${PERSONA_TONE[ag.persona] ?? 'bg-surface-2'}`}>{ag.name.slice(0, 1)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{ag.name}</span>
              <span className="block truncate text-xs text-muted">
                {group.key === 'main' ? modelName(ag.effectiveModel) : ag.tagline} · {ag.trades} сдел.
                {ag.status === 'stopped' && <span className="text-down"> · стоп</span>}
                {ag.running && <span className="text-ai"> · думает…</span>}
              </span>
            </span>
            <span className="hidden min-[400px]:block">
              <Sparkline data={[ag.startCapital, ...ag.curve.map((c) => c.equity), ag.equity]} width={56} height={22} fill={false} />
            </span>
            <span className="w-[4.5rem] shrink-0 text-right">
              <span className="block text-sm font-semibold tabular-nums">
                <Delta value={ag.returnPct} />
              </span>
              <span className="block text-xs whitespace-nowrap text-muted tabular-nums">{money(ag.equity)}</span>
            </span>
          </button>
        ))}
      </Surface>

      <Surface className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-left text-xs whitespace-nowrap text-muted">
            <tr className="border-b border-line/70">
              <th className="px-5 py-3 font-medium md:px-7">#</th>
              <th className="py-3 pr-4 font-medium">Агент</th>
              <th className="py-3 pr-4 font-medium">Кривая</th>
              <th className="py-3 pl-3 text-right font-medium">Счёт</th>
              <th className="py-3 pl-3 text-right font-medium">Доходность</th>
              <th className="py-3 pl-3 text-right font-medium" title="Максимальная просадка от пика">
                Просадка
              </th>
              <th className="py-3 pl-3 text-right font-medium" title="Доходность на единицу риска (годовая); считается после недели данных">
                Шарп
              </th>
              <th className="py-3 pl-3 text-right font-medium">Сделок</th>
              <th className="py-3 pl-3 text-right font-medium">Комиссии</th>
              <th className="px-5 py-3 text-right font-medium md:px-7">Статус</th>
            </tr>
          </thead>
          <tbody>
            {group.agents.map((ag, i) => (
              <tr
                key={ag.id}
                onClick={() => onSelect(ag.id)}
                className={`cursor-pointer border-b border-line/50 last:border-0 ${current === ag.id ? 'bg-accent/5' : 'hover:bg-surface-2/60'}`}
              >
                <td className="px-5 py-3 md:px-7">
                  <Rank n={i + 1} />
                </td>
                <td className="py-3">
                  <span className="flex items-center gap-3">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-xl text-sm font-bold ${PERSONA_TONE[ag.persona] ?? 'bg-surface-2'}`}>{ag.name.slice(0, 1)}</span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{ag.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {group.key === 'main' ? (
                          <>
                            {ag.tagline} · <span className="font-medium">{modelName(ag.effectiveModel)}</span>
                          </>
                        ) : (
                          ag.tagline
                        )}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <Sparkline data={[ag.startCapital, ...ag.curve.map((c) => c.equity), ag.equity]} width={96} height={28} />
                </td>
                <td className="py-3 pl-3 text-right font-semibold whitespace-nowrap tabular-nums">{money(ag.equity)}</td>
                <td className="py-3 pl-3 text-right tabular-nums">
                  <Delta value={ag.returnPct} />
                </td>
                <td className="py-3 pl-3 text-right tabular-nums text-muted">−{price(ag.maxDrawdownPct)}%</td>
                <td className="py-3 pl-3 text-right tabular-nums text-muted">{ag.sharpe ?? '—'}</td>
                <td className="py-3 pl-3 text-right tabular-nums">{ag.trades}</td>
                <td className="py-3 pl-3 text-right whitespace-nowrap tabular-nums text-muted">{money(ag.feesRub)}</td>
                <td className="px-5 py-3 text-right md:px-7">
                  <StatusPill agent={ag} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>

      <AgentPanel id={current} models={data.models} onChanged={refresh} />
    </div>
  );
}

export function Arena() {
  const qc = useQueryClient();
  const arena = useQuery({ queryKey: ['arena'], queryFn: api.arena, refetchInterval: 15_000 });
  const [tab, setTab] = useState<ArenaGroupKey | 'office'>('main');
  const [room, setRoom] = useState<ArenaGroupKey>('main');
  const [selected, setSelected] = useState<number>();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['arena'] });
    qc.invalidateQueries({ queryKey: ['arenaAgent'] });
  };
  const runAll = useMutation({ mutationFn: api.arenaRunAll, onSuccess: () => setTimeout(refresh, 500) });
  const pause = useMutation({ mutationFn: api.arenaPause, onSuccess: refresh });

  if (arena.isLoading) return <Skeleton className="h-72 rounded-[18px]" />;
  if (arena.error) return <ErrorText error={arena.error} />;
  if (!arena.data) return null;
  const a = arena.data;

  if (!a.configured) {
    return (
      <Surface className="p-6">
        <h1 className="text-xl font-semibold">Арена</h1>
        <p className="mt-2 text-muted">Нужны песочница T-Invest (TINKOFF_TOKEN, TINKOFF_SANDBOX=true) и хотя бы одна модель: ключ AI (AI_API_KEY) в backend/.env или запущенная Ollama.</p>
      </Surface>
    );
  }

  const total = a.groups.reduce((n, g) => n + g.agents.length, 0);
  const anyRunning = a.roundRunning || a.groups.some((g) => g.agents.some((x) => x.running));
  const group = a.groups.find((g) => g.key === tab) ?? a.groups[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-full overflow-x-auto">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              ...a.groups.map((g) => ({ value: g.key as ArenaGroupKey | 'office', label: `${g.title}${g.agents.length ? ` · ${g.agents.length}` : ''}` })),
              { value: 'office' as const, label: 'Офис' },
            ]}
          />
        </div>
        <span className="flex items-center gap-2 text-sm text-muted">
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink" title="Счета агентов виртуальные: живые цены биржи, комиссия 0,05%, настоящих денег нет">виртуально</span>
          {a.paused ? <span className="rounded-full bg-hold/20 px-2 py-0.5 text-[11px] font-semibold text-ink">на паузе</span> : <>ходы по будням в {a.runHoursMsk.map((h) => `${h}:00`).join(', ')} МСК</>}
          {anyRunning && <span className="text-ai">раунд идёт…</span>}
        </span>
        {total > 0 && (
          <span className="flex w-full gap-2 md:ml-auto md:w-auto">
            <Button variant="ai" onClick={() => runAll.mutate()} disabled={anyRunning || runAll.isPending || a.paused} title="Все активные агенты всех турниров принимают решение сейчас" className="flex-1 md:flex-none">
              <RotateCw className="size-4" aria-hidden /> Раунд сейчас
            </Button>
            <Button onClick={() => pause.mutate(!a.paused)} disabled={pause.isPending} className="flex-1 md:flex-none">
              {a.paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />} {a.paused ? 'Продолжить' : 'Пауза'}
            </Button>
          </span>
        )}
      </div>
      <ErrorText error={runAll.error ?? pause.error} />
      {tab === 'office' ? (
        total === 0 ? (
          <SetupCard group="main" data={a} />
        ) : (
          <div className="space-y-5">
            <Surface className="p-3 md:p-4">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <Segmented
                  size="sm"
                  value={room}
                  onChange={setRoom}
                  options={a.groups.filter((g) => g.agents.length > 0).map((g) => ({ value: g.key, label: `${g.title} · ${g.agents.length}` }))}
                />
                <span className="text-xs text-muted">Жёлтая метка — думает, зелёная — в игре, красная — остановлен. Облачко — последняя сделка. Тап по персонажу открывает журнал.</span>
              </div>
              <Office groups={a.groups.filter((g) => g.key === (a.groups.find((g) => g.key === room && g.agents.length)?.key ?? a.groups.find((g) => g.agents.length)?.key))} selected={selected} onSelect={setSelected} />
            </Surface>
            {selected !== undefined && <AgentPanel id={selected} models={a.models} onChanged={refresh} />}
          </div>
        )
      ) : group.agents.length === 0 ? (
        <SetupCard group={group.key} data={a} />
      ) : (
        <GroupView group={group} data={a} selected={selected} onSelect={setSelected} />
      )}
    </div>
  );
}
