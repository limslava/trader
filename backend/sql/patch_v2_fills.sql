CREATE TABLE IF NOT EXISTS execution_fills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES execution_orders(id) ON DELETE CASCADE,
  filled_qty NUMERIC(20,8) NOT NULL,
  price NUMERIC(20,8) NOT NULL,
  broker_trade_id VARCHAR(120),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_execution_fills_order ON execution_fills(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_execution_fills_broker_trade
  ON execution_fills(order_id, broker_trade_id)
  WHERE broker_trade_id IS NOT NULL;
