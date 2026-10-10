describe('tradingMode config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  test('defaults to paper mode', () => {
    delete process.env.TRADING_MODE;
    delete process.env.ENABLE_LIVE_TRADING;
    const { getTradingMode, isLiveTradingEnabled, shouldUsePaperExecution } = require('../dist/v2/config/tradingMode');

    expect(getTradingMode()).toBe('paper');
    expect(isLiveTradingEnabled()).toBe(false);
    expect(shouldUsePaperExecution('sandbox', 'tinkoff')).toBe(true);
  });

  test('requires explicit live flag for live trading', () => {
    process.env.TRADING_MODE = 'live';
    process.env.ENABLE_LIVE_TRADING = 'false';
    let config = require('../dist/v2/config/tradingMode');

    expect(config.isLiveTradingEnabled()).toBe(false);
    expect(config.canUseBrokerEnvironment('production')).toBe(false);

    jest.resetModules();
    process.env.TRADING_MODE = 'live';
    process.env.ENABLE_LIVE_TRADING = 'true';
    config = require('../dist/v2/config/tradingMode');

    expect(config.isLiveTradingEnabled()).toBe(true);
    expect(config.canUseBrokerEnvironment('production')).toBe(true);
  });
});
