ALTER TABLE execution_orders
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS locked_by VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_execution_orders_lock
  ON execution_orders (status, locked_until);
