export const exchangeRetryPolicy: Record<string, { attempts: number; baseDelayMs: number; breakerThreshold: number; breakerOpenMs: number }> = {
  bybit: { attempts: 4, baseDelayMs: 150, breakerThreshold: 6, breakerOpenMs: 15000 },
  okx: { attempts: 3, baseDelayMs: 200, breakerThreshold: 5, breakerOpenMs: 12000 },
  kucoin: { attempts: 3, baseDelayMs: 200, breakerThreshold: 5, breakerOpenMs: 12000 }
};
