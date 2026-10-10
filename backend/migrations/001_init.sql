CREATE TABLE watchlist (
  secid text PRIMARY KEY,
  shortname text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE analyses (
  id serial PRIMARY KEY,
  secid text NOT NULL,
  shortname text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  model text NOT NULL,
  price numeric NOT NULL,
  signal text NOT NULL CHECK (signal IN ('BUY', 'SELL', 'HOLD')),
  confidence numeric NOT NULL,
  question text,
  result jsonb NOT NULL,
  indicators jsonb NOT NULL
);

CREATE INDEX analyses_secid_created_idx ON analyses (secid, created_at DESC);
CREATE INDEX analyses_created_idx ON analyses (created_at DESC);
