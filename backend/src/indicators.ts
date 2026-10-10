import type { Candle } from './moex.js';

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

/** Full EMA series, seeded with the SMA of the first `period` values. Index i matches values[i]. */
export function emaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** RSI with Wilder smoothing. */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (loss === 0) return gain === 0 ? 50 : 100;
  return 100 - 100 / (1 + gain / loss);
}

export function macd(closes: number[], fast = 12, slow = 26, signal = 9) {
  const fastEma = emaSeries(closes, fast);
  const slowEma = emaSeries(closes, slow);
  const line: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f !== null && s !== null) line.push(f - s);
  }
  const signalSeries = emaSeries(line, signal);
  const lastSignal = signalSeries[signalSeries.length - 1];
  if (line.length === 0 || lastSignal == null) return null;
  const lastLine = line[line.length - 1];
  return { line: lastLine, signal: lastSignal, histogram: lastLine - lastSignal };
}

/** Average True Range with Wilder smoothing. */
export function atr(candles: Candle[], period = 14): number | null {
  if (candles.length <= period) return null;
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)));
  }
  let value = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < tr.length; i++) value = (value * (period - 1) + tr[i]) / period;
  return value;
}

export function bollinger(closes: number[], period = 20, mult = 2) {
  const mid = sma(closes, period);
  if (mid === null) return null;
  const window = closes.slice(-period);
  const sd = Math.sqrt(window.reduce((a, v) => a + (v - mid) ** 2, 0) / period);
  return { upper: mid + mult * sd, middle: mid, lower: mid - mult * sd };
}

/** Annualized volatility of daily log returns over the last `period` days, in percent. */
export function volatility(closes: number[], period = 20, tradingDays = 252): number | null {
  if (closes.length <= period) return null;
  const rets: number[] = [];
  for (let i = closes.length - period; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance * tradingDays) * 100;
}

/** Change from the last close on or before `days` calendar days ago (MOEX also trades on weekends now). */
function pctChangeDays(daily: Candle[], days: number): number | null {
  const last = daily[daily.length - 1];
  if (!last) return null;
  const cutoff = new Date(new Date(last.time.slice(0, 10)).getTime() - days * 86_400_000).toISOString().slice(0, 10);
  for (let i = daily.length - 2; i >= 0; i--) {
    if (daily[i].time.slice(0, 10) <= cutoff) return ((last.close - daily[i].close) / daily[i].close) * 100;
  }
  return null;
}

function lastDays(daily: Candle[], days: number): Candle[] {
  const last = daily[daily.length - 1];
  if (!last) return [];
  const cutoff = new Date(new Date(last.time.slice(0, 10)).getTime() - days * 86_400_000).toISOString().slice(0, 10);
  return daily.filter((c) => c.time.slice(0, 10) > cutoff);
}

const round = (v: number | null, digits = 2) => (v === null ? null : Number(v.toFixed(digits)));

export type IndicatorSnapshot = ReturnType<typeof computeIndicators>;

/** Builds the technical snapshot sent to the AI and shown in the UI. Expects daily candles, oldest first. */
export function computeIndicators(daily: Candle[]) {
  const closes = daily.map((c) => c.close);
  const last = daily[daily.length - 1];
  const yearWindow = lastDays(daily, 365);
  const barsPerYear = yearWindow.length >= 200 ? yearWindow.length : 252;
  const vol20 = sma(daily.map((c) => c.value), 20);
  const vol60 = sma(daily.map((c) => c.value), 60);
  const m = macd(closes);
  const bb = bollinger(closes);

  return {
    date: last?.time.slice(0, 10) ?? null,
    close: last?.close ?? null,
    bars: daily.length,
    sma20: round(sma(closes, 20)),
    sma50: round(sma(closes, 50)),
    sma200: round(sma(closes, 200)),
    rsi14: round(rsi(closes)),
    macd: m && { line: round(m.line, 3), signal: round(m.signal, 3), histogram: round(m.histogram, 3) },
    bollinger: bb && { upper: round(bb.upper), middle: round(bb.middle), lower: round(bb.lower) },
    atr14: round(atr(daily)),
    volatility20dPct: round(volatility(closes, 20, barsPerYear)),
    change1wPct: round(pctChangeDays(daily, 7)),
    change1mPct: round(pctChangeDays(daily, 30)),
    change3mPct: round(pctChangeDays(daily, 91)),
    change1yPct: round(pctChangeDays(daily, 365)),
    high52w: yearWindow.length ? Math.max(...yearWindow.map((c) => c.high)) : null,
    low52w: yearWindow.length ? Math.min(...yearWindow.map((c) => c.low)) : null,
    turnover20dAvgRub: vol20 === null ? null : Math.round(vol20),
    turnoverRatio20to60: vol20 !== null && vol60 ? round(vol20 / vol60) : null,
  };
}
