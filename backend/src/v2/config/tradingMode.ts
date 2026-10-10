export type TradingMode = 'paper' | 'sandbox' | 'live';
export type BrokerAccountEnvironment = 'paper' | 'sandbox' | 'production';

const tradingModes = new Set<TradingMode>(['paper', 'sandbox', 'live']);
const brokerEnvironments = new Set<BrokerAccountEnvironment>(['paper', 'sandbox', 'production']);

export const getTradingMode = (): TradingMode => {
  const raw = (process.env.TRADING_MODE || 'paper').toLowerCase();
  return tradingModes.has(raw as TradingMode) ? raw as TradingMode : 'paper';
};

export const isLiveTradingEnabled = (): boolean => {
  return getTradingMode() === 'live' && process.env.ENABLE_LIVE_TRADING === 'true';
};

export const isBrokerEnvironment = (value: unknown): value is BrokerAccountEnvironment => {
  return typeof value === 'string' && brokerEnvironments.has(value as BrokerAccountEnvironment);
};

export const canUseBrokerEnvironment = (environment: BrokerAccountEnvironment): boolean => {
  if (environment === 'production') {
    return isLiveTradingEnabled();
  }
  return true;
};

export const shouldUsePaperExecution = (environment?: string | null, broker?: string | null): boolean => {
  return getTradingMode() === 'paper' || environment === 'paper' || broker === 'paper';
};
