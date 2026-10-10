ALTER TABLE execution_orders
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS broker_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_execution_orders_broker_order_id
  ON execution_orders (broker_order_id);

CREATE INDEX IF NOT EXISTS idx_execution_orders_retry
  ON execution_orders (status, next_retry_at);
