import { useQuery } from '@tanstack/react-query';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineStyle,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { isoDaysAgo } from '../format';
import { token, useTheme } from '../theme';
import { ErrorText, Segmented, Spinner } from './ui';

const PERIODS = [
  { key: '1W', label: '1Н', interval: 10, days: 7 },
  { key: '1M', label: '1М', interval: 60, days: 31 },
  { key: '6M', label: '6М', interval: 24, days: 183 },
  { key: '1Y', label: '1Г', interval: 24, days: 365 },
  { key: '5Y', label: '5Л', interval: 7, days: 1826 },
] as const;

/** ISS times are Moscow local time; plotting them as UTC makes the axis show MSK. */
const toTs = (t: string) => (Date.parse(`${t.replace(' ', 'T')}Z`) / 1000) as UTCTimestamp;

type Props = { secid: string; levels?: { support: number[]; resistance: number[] }; heightClass?: string };

export function PriceChart({ secid, levels, heightClass = 'h-80 sm:h-96' }: Props) {
  const [periodKey, setPeriodKey] = useState<(typeof PERIODS)[number]['key']>('6M');
  const period = PERIODS.find((p) => p.key === periodKey)!;
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const from = isoDaysAgo(period.days);
  const { data, isLoading, error } = useQuery({
    queryKey: ['candles', secid, period.interval, from],
    queryFn: () => api.candles(secid, period.interval, from),
    refetchInterval: period.interval <= 60 ? 60_000 : false,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !data) return;

    // The chart library needs concrete colors, so read the current theme's tokens.
    const UP = token('--up');
    const DOWN = token('--down');
    const line = token('--line');
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: token('--muted'),
        fontFamily: 'Inter, system-ui, sans-serif',
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: line } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: period.interval < 24, secondsVisible: false },
      crosshair: { mode: 0 },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    candles.setData(data.map((c) => ({ time: toTs(c.time), open: c.open, high: c.high, low: c.low, close: c.close })));

    // Indices have no volume in ISS.
    if (data.some((c) => c.volume > 0)) {
      const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      volume.setData(
        data.map((c) => ({ time: toTs(c.time), value: c.volume, color: c.close >= c.open ? `${UP}55` : `${DOWN}55` })),
      );
    }

    // Only the two levels nearest to the current price on each side; more just clutters the chart.
    const last = data[data.length - 1]?.close ?? 0;
    const nearest = (list: number[] = [], below: boolean) =>
      list
        .filter((p) => (below ? p <= last : p >= last))
        .sort((a, b) => Math.abs(a - last) - Math.abs(b - last))
        .slice(0, 2);
    for (const price of nearest(levels?.support, true)) {
      candles.createPriceLine({ price, color: UP, lineStyle: LineStyle.Dashed, lineWidth: 1, title: 'поддержка' });
    }
    for (const price of nearest(levels?.resistance, false)) {
      candles.createPriceLine({ price, color: DOWN, lineStyle: LineStyle.Dashed, lineWidth: 1, title: 'сопротивление' });
    }

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data, levels, period.interval, theme]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Segmented
          size="sm"
          value={periodKey}
          onChange={setPeriodKey}
          options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
        />
        {isLoading && <Spinner className="text-muted" />}
      </div>
      <ErrorText error={error} />
      <div ref={containerRef} className={`w-full ${heightClass}`} />
    </div>
  );
}
