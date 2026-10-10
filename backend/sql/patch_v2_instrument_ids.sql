ALTER TABLE instruments
  ADD COLUMN IF NOT EXISTS instrument_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_instruments_instrument_id ON instruments(instrument_id);
