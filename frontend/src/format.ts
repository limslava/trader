const nf = (digits: number) =>
  new Intl.NumberFormat('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function price(v: number | null | undefined, decimals = 2): string {
  return v == null ? '—' : nf(decimals).format(v);
}

export function pct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v > 0 ? '+' : ''}${nf(2).format(v)}%`;
}

export function money(v: number | null | undefined): string {
  if (v == null) return '—';
  const a = Math.abs(v);
  if (a >= 1e12) return `${nf(2).format(v / 1e12)} трлн ₽`;
  if (a >= 1e9) return `${nf(1).format(v / 1e9)} млрд ₽`;
  if (a >= 1e6) return `${nf(1).format(v / 1e6)} млн ₽`;
  return `${nf(0).format(v)} ₽`;
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function changeColor(v: number | null | undefined): string {
  if (!v) return 'text-muted';
  return v > 0 ? 'text-up' : 'text-down';
}

export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export function date(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}
