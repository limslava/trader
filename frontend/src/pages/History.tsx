import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api, type Analysis } from '../api';
import { ScorecardCard } from '../components/ScorecardCard';
import { Empty, ErrorText, Monogram, SIGNAL_META, Skeleton, Surface } from '../components/ui';
import { price } from '../format';

function groupByDay(list: Analysis[]) {
  const groups = new Map<string, Analysis[]>();
  for (const a of list) {
    const day = new Date(a.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    groups.set(day, [...(groups.get(day) ?? []), a]);
  }
  return [...groups];
}

export function History() {
  const { data, isLoading, error } = useQuery({ queryKey: ['analyses', 'all'], queryFn: () => api.analyses() });

  return (
    <div className="space-y-5">
      <ScorecardCard />
      <ErrorText error={error} />
      {isLoading && <Skeleton className="h-64 rounded-[18px]" />}
      {data?.length === 0 && (
        <Surface className="p-6">
          <Empty>Анализов пока нет. Откройте любую компанию и нажмите «Получить вердикт».</Empty>
        </Surface>
      )}
      {data &&
        groupByDay(data).map(([day, items]) => (
          <section key={day}>
            <h2 className="mb-3 text-sm font-semibold text-muted">{day}</h2>
            <Surface className="divide-y divide-line/70 px-5 md:px-7">
              {items.map((a) => {
                const meta = SIGNAL_META[a.signal];
                return (
                  <Link key={a.id} to={`/s/${a.secid}`} className="group flex gap-4 py-5">
                    <Monogram secid={a.secid} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-semibold group-hover:underline">{a.shortname}</span>
                        <span className={`text-sm font-semibold ${meta.tone}`}>
                          {meta.verdict} · {Math.round(a.confidence * 100)}%
                        </span>
                        <span className="ml-auto text-xs text-muted">
                          {new Date(a.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · {price(a.price)} ₽
                        </span>
                      </span>
                      {a.question && <span className="mt-1 block text-sm text-muted">«{a.question}»</span>}
                      <span className="mt-1.5 line-clamp-2 block text-sm leading-relaxed text-ink-2">{a.result.summary}</span>
                    </span>
                  </Link>
                );
              })}
            </Surface>
          </section>
        ))}
    </div>
  );
}
