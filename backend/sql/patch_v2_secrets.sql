ALTER TABLE broker_credentials
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_broker_credentials_active
  ON broker_credentials (broker_account_id, is_active);
