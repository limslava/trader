import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Star } from 'lucide-react';
import { useState } from 'react';
import { Link, useMatch } from 'react-router';
import { api, type Quote, type Signal } from '../api';
import { pct, price } from '../format';
import { Segmented, Spinner } from './ui';

type Row = { secid: string; shortname: string; quote: Quote | null; signal?: Signal | null; weight?: number };

const SIGNAL_DOT: Record<Signal, string> = { BUY: 'bg-up', SELL: 'bg-down', HOLD: 'bg-hold' };
const SIGNAL_TEXT: Record<Signal, string> = { BUY: 'AI: покупать', SELL: 'AI: продавать', HOLD: 'AI: держать' };

function InstrumentRow({ row, active, watched, onToggle }: { row: Row; active: boolean; watched: boolean; onToggle: () => void }) {
  const q = row.quote;
  const change = q?.changePct ?? 0;
  return (
    <li className="group relative">
      <Link
        to={`/s/${row.secid}`}
        className={`flex items-center gap-2 rounded-xl px-3 py-2 transition ${active ? 'bg-accent/10' : 'hover:bg-panel-2'}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-semibold ${active ? 'text-accent' : ''}`}>{row.secid}</span>
            {row.signal && (
              <span className={`size-1.5 rounded-full ${SIGNAL_DOT[row.signal]}`} title={SIGNAL_TEXT[row.signal]} aria-label={SIGNAL_TEXT[row.signal]} />
            )}
          </div>
          <div className="truncate text-xs text-muted">{row.shortname}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium">{price(q?.price, q?.decimals)}</div>
          <div className={`text-xs font-medium ${change > 0 ? 'text-up' : change < 0 ? 'text-down' : 'text-muted'}`}>{pct(change)}</div>
        </div>
      </Link>
      <button
        onClick={onToggle}
        className={`absolute top-1/2 left-0 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-panel shadow-sm transition ${
          watched ? 'text-hold opacity-0 group-hover:opacity-100' : 'text-muted opacity-0 group-hover:opacity-100'
        } focus-visible:opacity-100`}
        aria-label={watched ? `Убрать ${row.secid} из вотчлиста` : `Добавить ${row.secid} в вотчлист`}
        title={watched ? 'Убрать из вотчлиста' : 'В вотчлист'}
      >
        <Star className={`size-3.5 ${watched ? 'fill-current' : ''}`} />
      </button>
    </li>
  );
}

/** Persistent instrument list: the user's watchlist or all IMOEX members. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'watch' | 'index'>('watch');
  const activeSecid = useMatch('/s/:secid')?.params.secid?.toUpperCase();

  const watchlist = useQuery({ queryKey: ['watchlist'], queryFn: api.watchlist, refetchInterval: 30_000 });
  const imoex = useQuery({ queryKey: ['imoex'], queryFn: api.imoex, enabled: tab === 'index', refetchInterval: 60_000 });
  const watched = new Set(watchlist.data?.map((w) => w.secid));

  const toggle = useMutation({
    mutationFn: (secid: string) => (watched.has(secid) ? api.unwatch(secid) : api.watch(secid)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const rows: Row[] =
    tab === 'watch'
      ? (watchlist.data ?? []).map((w) => ({ secid: w.secid, shortname: w.shortname, quote: w.quote, signal: w.lastAnalysis?.signal }))
      : (imoex.data ?? []).map((m) => ({ secid: m.secid, shortname: m.shortname, quote: m.quote, weight: m.weight }));
  const loading = tab === 'watch' ? watchlist.isLoading : imoex.isLoading;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <Segmented
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'watch', label: 'Вотчлист' },
            { value: 'index', label: 'Индекс' },
          ]}
        />
        {tab === 'watch' && (
          <Link
            to="/watchlist"
            onClick={onNavigate}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10"
            title="AI сравнит все бумаги вотчлиста"
          >
            <Sparkles className="size-3.5" aria-hidden />
            AI-обзор
          </Link>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" onClick={onNavigate}>
        {loading && (
          <div className="grid place-items-center py-8 text-muted">
            <Spinner />
          </div>
        )}
        {tab === 'watch' && watchlist.data?.length === 0 && (
          <p className="px-3 py-6 text-sm leading-relaxed text-muted">
            Список пуст. Откройте вкладку «Индекс» и добавьте бумаги звёздочкой — или найдите бумагу через поиск.
          </p>
        )}
        <ul className="space-y-0.5 pl-2">
          {rows.map((row) => (
            <InstrumentRow
              key={row.secid}
              row={row}
              active={row.secid === activeSecid}
              watched={watched.has(row.secid)}
              onToggle={() => toggle.mutate(row.secid)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
