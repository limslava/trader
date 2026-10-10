CREATE UNIQUE INDEX IF NOT EXISTS uq_execution_order_events_unique
  ON execution_order_events (order_id, event_type);
