import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { api } from '../api';

/** Last ~30 daily closes for many instruments in one request, cached for 10 minutes. */
export function useSparklines(secids: string[]) {
  const key = [...secids].sort().join(',');
  return useQuery({
    queryKey: ['sparklines', key],
    queryFn: () => api.sparklines(secids),
    enabled: secids.length > 0,
    staleTime: 10 * 60_000,
  });
}

/** Tiny trend line coloured by direction over the period, with a soft gradient fill. */
export function Sparkline({
  data,
  width = 96,
  height = 32,
  fill = true,
  stretch = false,
}: {
  data?: number[];
  width?: number;
  height?: number;
  fill?: boolean;
  /** Fill the parent's width (the path is drawn in a 0..width box and scaled). */
  stretch?: boolean;
}) {
  const id = useId();
  if (!data || data.length < 2)
    return <div style={{ width: stretch ? '100%' : width, height }} className="skeleton rounded-md" aria-hidden />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 2 - ((v - min) / span) * (height - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const color = data[data.length - 1] >= data[0] ? 'var(--up)' : 'var(--down)';
  return (
    <svg
      width={stretch ? '100%' : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
      className="overflow-visible"
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={`${line}L${width},${height}L0,${height}Z`} fill={`url(#${id})`} />
        </>
      )}
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
