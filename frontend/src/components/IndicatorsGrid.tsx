import type { Indicators } from '../api';
import { changeColor, money, pct, price } from '../format';

function Cell({ label, value, hint, className = '' }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <div className="rounded-lg bg-panel-2 px-3 py-2" title={hint}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-0.5 text-sm font-medium ${className}`}>{value}</div>
    </div>
  );
}

function rsiColor(v: number | null) {
  if (v == null) return '';
  if (v >= 70) return 'text-down';
  if (v <= 30) return 'text-up';
  return '';
}

export function IndicatorsGrid({ ind }: { ind: Indicators }) {
  const vsSma = (sma: number | null) =>
    sma != null && ind.close != null ? ` (${pct(((ind.close - sma) / sma) * 100)})` : '';
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      <Cell label="Неделя" value={pct(ind.change1wPct)} className={changeColor(ind.change1wPct)} />
      <Cell label="Месяц" value={pct(ind.change1mPct)} className={changeColor(ind.change1mPct)} />
      <Cell label="3 месяца" value={pct(ind.change3mPct)} className={changeColor(ind.change3mPct)} />
      <Cell label="Год" value={pct(ind.change1yPct)} className={changeColor(ind.change1yPct)} />
      <Cell label="RSI 14" value={price(ind.rsi14, 1)} className={rsiColor(ind.rsi14)} hint=">70 перекупленность, <30 перепроданность" />
      <Cell
        label="MACD гистограмма"
        value={price(ind.macd?.histogram, 3)}
        className={changeColor(ind.macd?.histogram)}
        hint="Разница между линией MACD и сигнальной"
      />
      <Cell label="SMA 50" value={price(ind.sma50) + vsSma(ind.sma50)} hint="В скобках — отклонение цены от средней" />
      <Cell label="SMA 200" value={price(ind.sma200) + vsSma(ind.sma200)} hint="В скобках — отклонение цены от средней" />
      <Cell label="52 недели" value={`${price(ind.low52w)} – ${price(ind.high52w)}`} />
      <Cell label="ATR 14" value={price(ind.atr14)} hint="Средний дневной диапазон" />
      <Cell label="Волатильность 20д" value={ind.volatility20dPct == null ? '—' : `${price(ind.volatility20dPct, 1)}% год.`} />
      <Cell
        label="Оборот 20д (средн.)"
        value={money(ind.turnover20dAvgRub)}
        hint={ind.turnoverRatio20to60 ? `К среднему за 60 дней: ×${ind.turnoverRatio20to60}` : undefined}
      />
    </div>
  );
}
