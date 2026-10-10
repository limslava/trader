CREATE TABLE IF NOT EXISTS crypto_error_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange VARCHAR(20) NOT NULL,
  code VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (exchange, code)
);

CREATE INDEX IF NOT EXISTS idx_crypto_error_map_exchange ON crypto_error_map(exchange);
