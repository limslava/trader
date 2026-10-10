DROP INDEX IF EXISTS uq_execution_fills_broker_trade;

CREATE UNIQUE INDEX IF NOT EXISTS uq_execution_fills_broker_trade
  ON execution_fills(order_id, broker_trade_id);
