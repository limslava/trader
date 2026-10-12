import type { IndicatorSnapshot } from './indicators.js';
import type { Fundamentals } from './tinkoff.js';

/**
 * Deterministic 0–100 score with three pillars, so the AI comments on a number instead of inventing one and
 * the technical part can be validated on history (fundamentals have no point-in-time history, so they are excluded
 * from the backtest).
 */

export type Pillar = { score: number; drivers: string[] };
export type Score = {
  total: number;
  label: 'strong' | 'neutral' | 'weak';
  tech: Pillar;
  relative: Pillar;
  fundamental: Pillar | null;
};

export type Relative = { vsImoex1mPct: number | null; vsImoex3mPct: number | null; vsImoex1yPct: number | null };

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function techScore(ind: IndicatorSnapshot): Pillar {
  let s = 50;
  const drivers: string[] = [];
  const add = (points: number, why: string) => {
    s += points;
    drivers.push(`${points > 0 ? '+' : ''}${points} ${why}`);
  };
  const c = ind.close;
  if (c != null) {
    if (ind.sma50 != null) add(c > ind.sma50 ? 8 : -8, c > ind.sma50 ? 'цена выше 50-дневной средней' : 'цена ниже 50-дневной средней');
    if (ind.sma200 != null) add(c > ind.sma200 ? 10 : -10, c > ind.sma200 ? 'выше 200-дневной — долгосрочный тренд вверх' : 'ниже 200-дневной — долгосрочный тренд вниз');
  }
  if (ind.sma50 != null && ind.sma200 != null) add(ind.sma50 > ind.sma200 ? 5 : -5, ind.sma50 > ind.sma200 ? '50-дневная выше 200-дневной' : '50-дневная ниже 200-дневной');
  const hist = ind.macd?.histogram;
  if (hist != null) add(hist > 0 ? 6 : -6, hist > 0 ? 'импульс (MACD) растёт' : 'импульс (MACD) падает');
  if (ind.rsi14 != null) {
    if (ind.rsi14 > 75) add(-10, `перегрев: RSI ${ind.rsi14.toFixed(0)}`);
    else if (ind.rsi14 >= 50) add(5, `здоровый импульс: RSI ${ind.rsi14.toFixed(0)}`);
    else if (ind.rsi14 < 30) add(3, `перепродана: RSI ${ind.rsi14.toFixed(0)}, возможен отскок`);
    else add(-3, `слабый импульс: RSI ${ind.rsi14.toFixed(0)}`);
  }
  if (ind.change1mPct != null) add(ind.change1mPct > 0 ? 4 : -4, `за месяц ${ind.change1mPct > 0 ? '+' : ''}${ind.change1mPct.toFixed(1)}%`);
  if (ind.change3mPct != null) add(ind.change3mPct > 0 ? 4 : -4, `за 3 месяца ${ind.change3mPct > 0 ? '+' : ''}${ind.change3mPct.toFixed(1)}%`);
  if (c != null && ind.high52w != null && ind.low52w != null && ind.high52w > ind.low52w) {
    const pos = (c - ind.low52w) / (ind.high52w - ind.low52w);
    if (pos > 0.85) add(3, 'у годового максимума');
    else if (pos < 0.15) add(-3, 'у годового минимума');
  }
  return { score: clamp(s), drivers };
}

export function relativeScore(rel: Relative): Pillar {
  let s = 50;
  const drivers: string[] = [];
  const add = (points: number, why: string) => {
    s += points;
    drivers.push(`${points > 0 ? '+' : ''}${points} ${why}`);
  };
  if (rel.vsImoex1mPct != null) add(Math.round(clamp(rel.vsImoex1mPct * 1.5, -15, 15)), `за месяц ${rel.vsImoex1mPct > 0 ? 'сильнее' : 'слабее'} индекса на ${Math.abs(rel.vsImoex1mPct).toFixed(1)} п.п.`);
  if (rel.vsImoex3mPct != null) add(Math.round(clamp(rel.vsImoex3mPct, -15, 15)), `за 3 месяца ${rel.vsImoex3mPct > 0 ? 'сильнее' : 'слабее'} индекса на ${Math.abs(rel.vsImoex3mPct).toFixed(1)} п.п.`);
  if (rel.vsImoex1yPct != null) add(Math.round(clamp(rel.vsImoex1yPct * 0.5, -20, 20)), `за год ${rel.vsImoex1yPct > 0 ? 'сильнее' : 'слабее'} индекса на ${Math.abs(rel.vsImoex1yPct).toFixed(1)} п.п.`);
  return { score: clamp(s), drivers };
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function fundamentalScore(f: Fundamentals | null): Pillar | null {
  if (!f) return null;
  let s = 50;
  const drivers: string[] = [];
  const add = (points: number, why: string) => {
    s += points;
    drivers.push(`${points > 0 ? '+' : ''}${points} ${why}`);
  };
  const pe = num(f.peRatioTtm);
  const ni = num(f.netIncomeTtm);
  if (ni != null && ni < 0) add(-15, 'убыток за последние 12 месяцев');
  else if (pe != null) {
    if (pe <= 5) add(12, `очень дёшево: P/E ${pe.toFixed(1)}`);
    else if (pe <= 8) add(6, `дёшево: P/E ${pe.toFixed(1)}`);
    else if (pe > 15) add(-6, `дорого: P/E ${pe.toFixed(1)}`);
  }
  const pb = num(f.priceToBookTtm);
  if (pb != null) {
    if (pb < 1) add(6, `ниже балансовой стоимости: P/B ${pb.toFixed(2)}`);
    else if (pb > 3) add(-4, `P/B ${pb.toFixed(1)} — премия к балансу`);
  }
  const roe = num(f.roe);
  if (roe != null) {
    if (roe > 20) add(10, `высокая рентабельность: ROE ${roe.toFixed(0)}%`);
    else if (roe >= 10) add(5, `ROE ${roe.toFixed(0)}%`);
    else if (roe < 0) add(-10, 'отрицательная рентабельность');
  }
  const dy = num(f.dividendYieldDailyTtm);
  if (dy != null) {
    if (dy >= 10) add(10, `дивиденды ${dy.toFixed(1)}%`);
    else if (dy >= 5) add(5, `дивиденды ${dy.toFixed(1)}%`);
  }
  const nd = num(f.netDebtToEbitda);
  if (nd != null) {
    if (nd > 3) add(-10, `высокий долг: ${nd.toFixed(1)}× EBITDA`);
    else if (nd < 1) add(5, 'низкий долг');
  }
  const rev = num(f.revenueChangeFiveYears);
  if (rev != null && rev > 30) add(4, `выручка за 5 лет +${rev.toFixed(0)}%`);
  return { score: clamp(s), drivers };
}

export function computeScore(ind: IndicatorSnapshot, rel: Relative, f: Fundamentals | null): Score {
  const tech = techScore(ind);
  const relative = relativeScore(rel);
  const fundamental = fundamentalScore(f);
  const total = Math.round(
    fundamental ? 0.45 * tech.score + 0.25 * relative.score + 0.3 * fundamental.score : 0.65 * tech.score + 0.35 * relative.score,
  );
  return { total, label: total >= 65 ? 'strong' : total <= 40 ? 'weak' : 'neutral', tech, relative, fundamental };
}

/** Technical + relative part only: this is what the walk-forward backtest can reproduce point-in-time. */
export function quantScore(ind: IndicatorSnapshot, rel: Relative): number {
  return Math.round(0.65 * techScore(ind).score + 0.35 * relativeScore(rel).score);
}
