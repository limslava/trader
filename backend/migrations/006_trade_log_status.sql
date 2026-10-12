-- Orders are now logged before they are sent, so the status can be PENDING/FAILED and order_id may be unknown.
CREATE INDEX trade_log_order_id_idx ON trade_log (order_id);
CREATE INDEX trade_log_secid_idx ON trade_log (secid, created_at DESC);
