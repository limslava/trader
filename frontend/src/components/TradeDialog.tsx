import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { price } from '../format';
import { SandboxBadge, TradeTicket } from './TradeTicket';
import { Delta, Monogram, Spinner } from './ui';

/** Pick an instrument (popular list or search), then trade it — without leaving the current page. */
function Picker({ onPick }: { onPick: (secid: string) => void }) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 200);
    return () => clearTimeout(t);
  }, [text]);

  const popular = useQuery({ queryKey: ['imoex'], queryFn: api.imoex, staleTime: 60_000 });
  const search = useQuery({ queryKey: ['search', query], queryFn: () => api.search(query), enabled: query.length >= 2, staleTime: 60 * 60_000 });

  const searching = query.length >= 2;
  return (
    <div>
      <label className="mb-3 flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:border-ink/30">
        <Search className="size-4 text-muted" aria-hidden />
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Тикер или компания"
          aria-label="Найти бумагу"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
        {search.isFetching && <Spinner className="text-muted" />}
      </label>
      {!searching && <div className="mb-1 px-1 text-xs font-medium text-muted">Популярные</div>}
      <ul className="-mx-2 max-h-[52vh] overflow-y-auto">
        {searching
          ? search.data?.map((r) => (
              <li key={r.secid}>
                <button onClick={() => onPick(r.secid)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2">
                  <Monogram secid={r.secid} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{r.secid}</span>
                    <span className="block truncate text-xs text-muted">{r.name}</span>
                  </span>
                </button>
              </li>
            ))
          : popular.data?.slice(0, 15).map((m) => (
              <li key={m.secid}>
                <button onClick={() => onPick(m.secid)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2">
                  <Monogram secid={m.secid} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{m.secid}</span>
                    <span className="block truncate text-xs text-muted">{m.shortname}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold">{price(m.quote?.price)}</span>
                    <Delta value={m.quote?.changePct} size="sm" />
                  </span>
                </button>
              </li>
            ))}
        {searching && !search.isFetching && search.data?.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">Ничего не нашлось</li>}
      </ul>
    </div>
  );
}

export function TradeDialog({ secid: initial, onClose }: { secid?: string; onClose: () => void }) {
  const [secid, setSecid] = useState(initial);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Сделка"
        className="w-full max-w-md animate-rise rounded-3xl border border-line bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          {secid && !initial && (
            <button onClick={() => setSecid(undefined)} className="grid size-8 place-items-center rounded-full hover:bg-surface-2" aria-label="Выбрать другую бумагу">
              <ChevronLeft className="size-4" />
            </button>
          )}
          <h2 className="text-base font-semibold">{secid ? `Сделка · ${secid}` : 'Что купить?'}</h2>
          <span className="ml-auto">
            <SandboxBadge />
          </span>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-full hover:bg-surface-2" aria-label="Закрыть">
            <X className="size-4" />
          </button>
        </div>
        {secid ? <TradeTicket secid={secid} /> : <Picker onPick={setSecid} />}
      </div>
    </div>
  );
}
