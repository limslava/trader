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
import { ErrorText, Spinner } from './ui';

const PERIODS = [
  { key: '1W', label: '1Н', interval: 10, days: 7 },
  { key: '1M', label: '1М', interval: 60, days: 31 },
  { key: '6M', label: '6М', interval: 24, days: 183 },
  { key: '1Y', label: '1Г', interval: 24, days: 365 },
  { key: '5Y', label: '5Л', interval: 7, days: 1826 },
] as const;

const UP = '#34d399';
const DOWN = '#f87171';

/** ISS times are Moscow local time; plotting them as UTC makes the axis show MSK. */
const toTs = (t: string) => (Date.parse(`${t.replace(' ', 'T')}Z`) / 1000) as UTCTimestamp;

type Props = { secid: string; levels?: { support: number[]; resistance: number[] } };

export function PriceChart({ secid, levels }: Props) {
  const [periodKey, setPeriodKey] = useState<(typeof PERIODS)[number]['key']>('6M');
  const period = PERIODS.find((p) => p.key === periodKey)!;
  const containerRef = useRef<HTMLDivElement>(null);

  const from = isoDaysAgo(period.days);
  const { data, isLoading, error } = useQuery({
    queryKey: ['candles', secid, period.interval, from],
    queryFn: () => api.candles(secid, period.interval, from),
    refetchInterval: period.interval <= 60 ? 60_000 : false,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !data) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#8b95a8', attributionLogo: false },
      grid: { vertLines: { color: '#1a2233' }, horzLines: { color: '#1a2233' } },
      rightPriceScale: { borderColor: '#232c40' },
      timeScale: { borderColor: '#232c40', timeVisible: period.interval < 24, secondsVisible: false },
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

    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volume.setData(
      data.map((c) => ({ time: toTs(c.time), value: c.volume, color: c.close >= c.open ? `${UP}55` : `${DOWN}55` })),
    );

    for (const price of levels?.support ?? []) {
      candles.createPriceLine({ price, color: UP, lineStyle: LineStyle.Dashed, lineWidth: 1, title: 'поддержка' });
    }
    for (const price of levels?.resistance ?? []) {
      candles.createPriceLine({ price, color: DOWN, lineStyle: LineStyle.Dashed, lineWidth: 1, title: 'сопротивление' });
    }

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data, levels, period.interval]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriodKey(p.key)}
            className={`rounded-md px-2.5 py-1 text-xs ${p.key === periodKey ? 'bg-panel-2 text-white' : 'text-muted hover:text-white'}`}
          >
            {p.label}
          </button>
        ))}
        {isLoading && <Spinner className="ml-2 text-muted" />}
      </div>
      <ErrorText error={error} />
      <div ref={containerRef} className="h-80 w-full sm:h-96" />
    </div>
  );
}
