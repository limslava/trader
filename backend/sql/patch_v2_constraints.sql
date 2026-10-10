ALTER TABLE execution_orders
  ADD CONSTRAINT execution_orders_status_check
  CHECK (status IN ('new', 'queued', 'accepted', 'rejected', 'cancelled', 'filled', 'partially_filled'));
