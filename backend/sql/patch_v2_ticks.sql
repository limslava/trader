CREATE TABLE IF NOT EXISTS market_ticks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange VARCHAR(20) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  price NUMERIC(20,8) NOT NULL,
  ts BIGINT NOT NULL,
  source VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_ticks_symbol_ts ON market_ticks(symbol, ts DESC);
CREATE INDEX IF NOT EXISTS idx_market_ticks_exchange_ts ON market_ticks(exchange, ts DESC);
