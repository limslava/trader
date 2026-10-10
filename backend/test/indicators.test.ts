import { describe, expect, it } from 'vitest';
import { atr, bollinger, computeIndicators, emaSeries, macd, rsi, sma, volatility } from '../src/indicators.js';
import type { Candle } from '../src/moex.js';

function candles(closes: number[], start = '2025-01-01'): Candle[] {
  const t0 = new Date(start).getTime();
  return closes.map((close, i) => ({
    time: `${new Date(t0 + i * 86_400_000).toISOString().slice(0, 10)} 00:00:00`,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
    value: 1000 * close,
  }));
}

describe('indicators', () => {
  it('sma averages the last N values', () => {
    expect(sma([1, 2, 3, 4, 5], 2)).toBe(4.5);
    expect(sma([1, 2], 3)).toBeNull();
  });

  it('ema of a constant series is the constant', () => {
    const series = emaSeries([5, 5, 5, 5, 5], 3);
    expect(series.slice(0, 2)).toEqual([null, null]);
    expect(series[4]).toBe(5);
  });

  it('rsi is 100 for a strictly rising series and 0 for a falling one', () => {
    const up = Array.from({ length: 30 }, (_, i) => 100 + i);
    expect(rsi(up)).toBe(100);
    expect(rsi([...up].reverse())).toBe(0);
  });

  it('rsi matches the classic Wilder example', () => {
    // Wilder's reference series; avg gain 0.2385, avg loss 0.1000 -> RSI(14) ~70.46.
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28,
    ];
    expect(rsi(closes)).toBeCloseTo(70.46, 1);
  });

  it('macd histogram is positive in an accelerating uptrend', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i * i * 0.05);
    expect(macd(closes)!.histogram).toBeGreaterThan(0);
  });

  it('atr equals the constant range when there are no gaps', () => {
    expect(atr(candles(Array(30).fill(100)))).toBeCloseTo(2);
  });

  it('bollinger bands collapse on a flat series', () => {
    expect(bollinger(Array(20).fill(10))).toEqual({ upper: 10, middle: 10, lower: 10 });
  });

  it('volatility is zero for constant returns', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 * 1.01 ** i);
    expect(volatility(closes)).toBeCloseTo(0, 6);
  });

  it('computeIndicators uses calendar days for period returns', () => {
    const closes = Array.from({ length: 400 }, (_, i) => 100 + i);
    const snap = computeIndicators(candles(closes));
    // 7 calendar days back on daily bars = 7 bars back.
    expect(snap.change1wPct).toBeCloseTo(((499 - 492) / 492) * 100, 2);
    expect(snap.high52w).toBe(500);
    expect(snap.sma200).not.toBeNull();
  });
});
