import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../api';
import { Card, Empty, ErrorText, SignalBadge, Spinner } from '../components/ui';
import { dateTime, price } from '../format';

export function History() {
  const { data, isLoading, error } = useQuery({ queryKey: ['analyses', 'all'], queryFn: () => api.analyses() });

  return (
    <Card title="История анализов" actions={isLoading ? <Spinner className="text-muted" /> : null}>
      <ErrorText error={error} />
      {data?.length === 0 && <Empty>Анализов пока нет.</Empty>}
      <ul className="divide-y divide-line">
        {data?.map((a) => (
          <li key={a.id}>
            <Link to={`/s/${a.secid}`} className="flex flex-col gap-1 py-3 hover:bg-panel-2 sm:-mx-4 sm:px-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="w-16 font-semibold">{a.secid}</span>
                <SignalBadge signal={a.signal} confidence={a.confidence} />
                <span className="text-muted">@ {price(a.price)}</span>
                <span className="ml-auto text-xs text-muted">{dateTime(a.createdAt)}</span>
              </div>
              <p className="line-clamp-2 text-sm text-fg-2">{a.result.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
