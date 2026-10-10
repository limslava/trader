import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router';
import { api } from '../api';

export function SearchBox() {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const { data = [], isFetching } = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.search(query),
    enabled: query.length >= 2,
    staleTime: 60 * 60_000,
  });

  const go = (secid: string) => {
    setText('');
    setOpen(false);
    navigate(`/s/${secid}`);
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        aria-label="Поиск бумаги"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, data.length - 1));
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          else if (e.key === 'Enter' && data[active]) go(data[active].secid);
          else if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Найти акцию: SBER, Газпром…"
        className="w-full rounded-xl border border-transparent bg-panel-2 py-2.5 pr-3 pl-9 text-sm outline-none transition placeholder:text-muted focus:border-accent focus:bg-panel"
      />
      {open && query.length >= 2 && (
        <ul className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-line bg-panel py-1 shadow-xl">
          {data.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">{isFetching ? 'Ищу…' : 'Ничего не найдено'}</li>
          )}
          {data.map((r, i) => (
            <li key={r.secid}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r.secid)}
                className={`flex w-full items-baseline gap-3 px-3 py-2 text-left text-sm ${i === active ? 'bg-panel-2' : ''}`}
              >
                <span className="w-16 shrink-0 font-semibold">{r.secid}</span>
                <span className="truncate text-muted">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
