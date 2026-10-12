import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Minus, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../api';
import { ErrorText, Skeleton } from './ui';

/**
 * Lightweight window manager: several draggable, resizable article windows at once, so a headline can be read
 * without leaving the app. On phones a window takes the whole screen.
 */

type Win = { id: number; url: string; title: string; x: number; y: number; w: number; h: number; z: number; minimized: boolean };

const Ctx = createContext<{ open: (url: string, title: string) => void }>({ open: () => {} });
export const useWindows = () => useContext(Ctx);

let nextId = 1;
let nextZ = 100;

export function WindowProvider({ children }: { children: ReactNode }) {
  const [wins, setWins] = useState<Win[]>([]);

  const open = useCallback((url: string, title: string) => {
    setWins((ws) => {
      const existing = ws.find((w) => w.url === url);
      if (existing) return ws.map((w) => (w.id === existing.id ? { ...w, z: ++nextZ, minimized: false } : w));
      // Cascade new windows so they don't stack exactly on top of each other.
      const n = ws.length;
      const w = Math.min(680, window.innerWidth - 48);
      const h = Math.min(560, window.innerHeight - 96);
      return [...ws, { id: nextId++, url, title, x: 80 + (n % 6) * 32, y: 72 + (n % 6) * 28, w, h, z: ++nextZ, minimized: false }];
    });
  }, []);

  const update = (id: number, patch: Partial<Win>) => setWins((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const close = (id: number) => setWins((ws) => ws.filter((w) => w.id !== id));
  const value = useMemo(() => ({ open }), [open]);
  const minimized = wins.filter((w) => w.minimized);

  return (
    <Ctx.Provider value={value}>
      {children}
      {wins.filter((w) => !w.minimized).map((w) => (
        <FloatingWindow key={w.id} win={w} onChange={(p) => update(w.id, p)} onClose={() => close(w.id)} onFocus={() => update(w.id, { z: ++nextZ })} />
      ))}
      {minimized.length > 0 && (
        <div className="fixed bottom-24 left-1/2 z-[90] flex max-w-[90vw] -translate-x-1/2 gap-2 overflow-x-auto rounded-full border border-line bg-surface p-1.5 shadow-2xl md:bottom-4">
          {minimized.map((w) => (
            <button
              key={w.id}
              onClick={() => update(w.id, { minimized: false, z: ++nextZ })}
              className="max-w-56 truncate rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:bg-line/70"
              title={w.title}
            >
              {w.title}
            </button>
          ))}
        </div>
      )}
    </Ctx.Provider>
  );
}

function FloatingWindow({ win, onChange, onClose, onFocus }: { win: Win; onChange: (p: Partial<Win>) => void; onClose: () => void; onFocus: () => void }) {
  const mobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const drag = useRef<{ mode: 'move' | 'resize'; sx: number; sy: number; x: number; y: number; w: number; h: number } | null>(null);

  const start = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    if (mobile) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, x: win.x, y: win.y, w: win.w, h: win.h };
    onFocus();
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (d.mode === 'move') {
      onChange({ x: Math.max(0, Math.min(window.innerWidth - 120, d.x + dx)), y: Math.max(0, Math.min(window.innerHeight - 48, d.y + dy)) });
    } else {
      onChange({ w: Math.max(320, Math.min(window.innerWidth - win.x, d.w + dx)), h: Math.max(240, Math.min(window.innerHeight - win.y, d.h + dy)) });
    }
  };
  const end = () => (drag.current = null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const style = mobile ? { inset: 0 } : { left: win.x, top: win.y, width: win.w, height: win.h };

  return (
    <section
      role="dialog"
      aria-label={win.title}
      onPointerDown={onFocus}
      style={{ ...style, zIndex: win.z }}
      className={`fixed flex flex-col overflow-hidden border border-line bg-surface shadow-2xl ${mobile ? 'rounded-none' : 'rounded-2xl'}`}
    >
      <header
        onPointerDown={start('move')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className={`flex shrink-0 items-center gap-2 border-b border-line/70 bg-surface-2/70 px-3 py-2 select-none ${mobile ? '' : 'cursor-move'}`}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{win.title}</span>
        <a
          href={win.url}
          target="_blank"
          rel="noreferrer noopener"
          onPointerDown={(e) => e.stopPropagation()}
          className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink"
          title="Открыть на сайте"
          aria-label="Открыть на сайте"
        >
          <ExternalLink className="size-4" />
        </a>
        {!mobile && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onChange({ minimized: true })}
            className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink"
            aria-label="Свернуть"
          >
            <Minus className="size-4" />
          </button>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="grid size-7 place-items-center rounded-lg text-muted hover:bg-down/10 hover:text-down"
          aria-label="Закрыть"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <ArticleView url={win.url} fallbackTitle={win.title} />
      </div>
      {!mobile && (
        <div
          onPointerDown={start('resize')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="absolute right-0 bottom-0 size-5 cursor-nwse-resize"
          aria-hidden
        >
          <svg viewBox="0 0 20 20" className="size-5 text-muted/60">
            <path d="M18 8L8 18M18 13l-5 5M18 18h0" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      )}
    </section>
  );
}

function ArticleView({ url, fallbackTitle }: { url: string; fallbackTitle: string }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['article', url], queryFn: () => api.article(url), staleTime: 60 * 60_000, retry: false });
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }
  if (error) return <ErrorText error={error} />;
  if (!data) return null;
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">{data.title || fallbackTitle}</h1>
      <p className="mt-1 mb-4 text-xs text-muted">
        {data.siteName}
        {data.byline && ` · ${data.byline}`}
      </p>
      {data.fallback ? (
        <div className="space-y-3">
          {data.summary ? <p className="text-sm leading-relaxed text-ink-2">{data.summary}</p> : <p className="text-sm text-muted">Сайт не отдаёт текст статьи сторонним программам.</p>}
          <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
            Открыть на сайте <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      ) : (
        <div className="space-y-3 text-[15px] leading-relaxed text-ink">
          {data.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
    </article>
  );
}
