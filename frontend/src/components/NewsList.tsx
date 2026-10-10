import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { dateTime } from '../format';
import { Card, Empty, ErrorText, Spinner } from './ui';

/** Headlines for one instrument, or market news when `secid` is omitted. */
export function NewsCard({ secid, title }: { secid?: string; title: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['news', secid ?? 'market'],
    queryFn: () => (secid ? api.news(secid) : api.marketNews()),
    staleTime: 15 * 60_000,
  });

  return (
    <Card title={title} actions={isLoading ? <Spinner className="text-muted" /> : null}>
      <ErrorText error={error} />
      {data?.length === 0 && <Empty>Свежих новостей не нашлось.</Empty>}
      <ul className="space-y-2.5">
        {data?.map((n) => (
          <li key={n.url} className="text-sm">
            <a href={n.url} target="_blank" rel="noreferrer noopener" className="text-slate-200 hover:text-accent hover:underline">
              {n.title}
            </a>
            <div className="mt-0.5 text-xs text-muted">
              {n.source}
              {n.publishedAt && ` · ${dateTime(n.publishedAt)}`}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">Google Новости, последние 2 недели. AI учитывает эти заголовки в анализе.</p>
    </Card>
  );
}
