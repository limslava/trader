import { useQuery } from '@tanstack/react-query';
import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api';
import { price } from '../format';
import { Delta, Spinner } from './ui';

/** Spotlight-style instrument search, opened with ⌘K / Ctrl+K or "/". */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setText('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 200);
    return () => clearTimeout(t);
  }, [text]);

  const search = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.search(query),
    enabled: open && query.length >= 2,
    staleTime: 60 * 60_000,
  });
  const watchlist = useQuery({ queryKey: ['watchlist'], queryFn: api.watchlist, enabled: open });

  if (!open) return null;

  const items =
    query.length >= 2
      ? (search.data ?? []).map((r) => ({ secid: r.secid, title: r.shortname, subtitle: r.name, price: null, change: null }))
      : (watchlist.data ?? []).map((w) => ({
          secid: w.secid,
          title: w.shortname,
          subtitle: 'В вотчлисте',
          price: w.quote?.price ?? null,
          change: w.quote?.changePct ?? null,
        }));

  const go = (secid: string) => {
    onClose();
    navigate(`/s/${secid}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl animate-rise overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Поиск бумаги"
      >
        <div className="flex items-center gap-3 border-b border-line px-5">
          <Search className="size-5 text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, items.length - 1));
              else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
              else if (e.key === 'Enter' && items[active]) go(items[active].secid);
            }}
            placeholder="Тикер или компания: SBER, Яндекс, Лукойл…"
            aria-label="Тикер или название компании"
            className="h-16 flex-1 bg-transparent text-lg outline-none placeholder:text-muted"
          />
          {search.isFetching && <Spinner className="text-muted" />}
          <kbd className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs text-muted">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {query.length < 2 && items.length > 0 && <li className="px-3 pt-2 pb-1 text-xs font-medium text-muted">Ваш вотчлист</li>}
          {query.length >= 2 && !search.isFetching && items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted">Ничего не нашлось</li>
          )}
          {items.map((it, i) => (
            <li key={it.secid}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(it.secid)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${i === active ? 'bg-surface-2' : ''}`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-xs font-bold">{it.secid.slice(0, 4)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{it.secid}</span>
                  <span className="block truncate text-sm text-muted">{it.subtitle === 'В вотчлисте' ? it.title : it.subtitle}</span>
                </span>
                {it.price != null && (
                  <span className="text-right">
                    <span className="block font-semibold">{price(it.price)}</span>
                    <Delta value={it.change} size="sm" />
                  </span>
                )}
                {i === active && <CornerDownLeft className="size-4 text-muted" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
