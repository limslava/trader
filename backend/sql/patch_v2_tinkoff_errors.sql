CREATE TABLE IF NOT EXISTS tinkoff_error_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_tinkoff_error_map_code
  ON tinkoff_error_map (code);
