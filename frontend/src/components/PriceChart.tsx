import { useQuery } from '@tanstack/react-query';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  type UTCTimestamp,
} from 'lightweight-charts';
import { CandlestickChart, Spline } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { isoDaysAgo } from '../format';
import { token, useTheme } from '../theme';
import { Delta, ErrorText, Segmented } from './ui';

const PERIODS = [
  { key: '1W', label: '1Н', interval: 10, days: 7, caption: 'за неделю' },
  { key: '1M', label: '1М', interval: 60, days: 31, caption: 'за месяц' },
  { key: '6M', label: '6М', interval: 24, days: 183, caption: 'за полгода' },
  { key: '1Y', label: '1Г', interval: 24, days: 365, caption: 'за год' },
  { key: '5Y', label: '5Л', interval: 7, days: 1826, caption: 'за 5 лет' },
] as const;

type PeriodKey = (typeof PERIODS)[number]['key'];

/** ISS times are Moscow local time; plotting them as UTC makes the axis show MSK. */
const toTs = (t: string) => (Date.parse(`${t.replace(' ', 'T')}Z`) / 1000) as UTCTimestamp;

const alpha = (hex: string, a: number) =>
  `${hex}${Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')}`;

type Props = {
  secid: string;
  levels?: { support: number[]; resistance: number[] };
  height?: string;
  defaultPeriod?: PeriodKey;
  /** Stretch to the parent's height instead of a fixed one. */
  fill?: boolean;
};

export function PriceChart({ secid, levels, height = 'h-[360px]', defaultPeriod = '6M', fill = false }: Props) {
  const [periodKey, setPeriodKey] = useState<PeriodKey>(defaultPeriod);
  const [mode, setMode] = useState<'area' | 'candles'>('area');
  const period = PERIODS.find((p) => p.key === periodKey)!;
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const from = isoDaysAgo(period.days);
  const { data, isLoading, error } = useQuery({
    queryKey: ['candles', secid, period.interval, from],
    queryFn: () => api.candles(secid, period.interval, from),
    refetchInterval: period.interval <= 60 ? 60_000 : false,
  });

  const first = data?.[0]?.open;
  const last = data?.[data.length - 1]?.close;
  const change = first && last ? ((last - first) / first) * 100 : null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !data?.length) return;

    // The chart library needs concrete colours, so read the current theme's tokens.
    const up = token('--up');
    const down = token('--down');
    const trend = (last ?? 0) >= (first ?? 0) ? up : down;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: token('--muted'),
        fontFamily: 'Onest, system-ui, sans-serif',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderVisible: false, timeVisible: period.interval < 24, secondsVisible: false },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: token('--line'), width: 1, style: LineStyle.Solid, labelBackgroundColor: token('--ink') },
        horzLine: { color: token('--line'), width: 1, style: LineStyle.Dashed, labelBackgroundColor: token('--ink') },
      },
      handleScale: { mouseWheel: false },
    });

    const priceSeries =
      mode === 'area'
        ? chart.addSeries(AreaSeries, {
            lineColor: trend,
            lineWidth: 2,
            topColor: alpha(trend, 0.22),
            bottomColor: alpha(trend, 0),
            priceLineVisible: false,
          })
        : chart.addSeries(CandlestickSeries, {
            upColor: up,
            downColor: down,
            borderVisible: false,
            wickUpColor: up,
            wickDownColor: down,
            priceLineVisible: false,
          });
    if (mode === 'area') {
      priceSeries.setData(data.map((c) => ({ time: toTs(c.time), value: c.close })));
    } else {
      priceSeries.setData(data.map((c) => ({ time: toTs(c.time), open: c.open, high: c.high, low: c.low, close: c.close })));
    }

    // Indices have no volume in ISS.
    if (mode === 'candles' && data.some((c) => c.volume > 0)) {
      const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      volume.setData(data.map((c) => ({ time: toTs(c.time), value: c.volume, color: alpha(c.close >= c.open ? up : down, 0.3) })));
    }

    // Two nearest AI levels on each side of the price; more just clutters.
    const lastClose = data[data.length - 1].close;
    const narrow = el.clientWidth < 520; // phones: colour alone, labels would cover the line
    const nearest = (list: number[] = [], below: boolean) =>
      list
        .filter((p) => (below ? p <= lastClose : p >= lastClose))
        .sort((a, b) => Math.abs(a - lastClose) - Math.abs(b - lastClose))
        .slice(0, 2);
    for (const price of nearest(levels?.support, true)) {
      priceSeries.createPriceLine({ price, color: alpha(up, 0.7), lineStyle: LineStyle.Dotted, lineWidth: 1, title: narrow ? '' : 'поддержка' });
    }
    for (const price of nearest(levels?.resistance, false)) {
      priceSeries.createPriceLine({ price, color: alpha(down, 0.7), lineStyle: LineStyle.Dotted, lineWidth: 1, title: narrow ? '' : 'сопротивление' });
    }

    chart.timeScale().fitContent();
    // The container may still be growing (flex layouts); refit whenever its size changes.
    const ro = new ResizeObserver(() => chart.timeScale().fitContent());
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [data, levels, period.interval, theme, mode, first, last]);

  return (
    <div className={fill ? 'flex h-full flex-col' : ''}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex h-7 items-center gap-2 text-sm">
          {change !== null && (
            <>
              <Delta value={change} />
              <span className="text-muted">{period.caption}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'area', label: <Spline className="size-3.5" aria-label="Линия" /> },
              { value: 'candles', label: <CandlestickChart className="size-3.5" aria-label="Свечи" /> },
            ]}
          />
          <Segmented size="sm" value={periodKey} onChange={setPeriodKey} options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} />
        </div>
      </div>
      <ErrorText error={error} />
      <div className={`relative w-full ${fill ? 'min-h-[240px] flex-1' : height}`}>
        {isLoading && <div className="skeleton absolute inset-0 rounded-2xl" aria-hidden />}
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
