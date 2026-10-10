-- Local audit trail of every order sent to the broker, with the raw response.
CREATE TABLE trade_log (
  id serial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid NOT NULL UNIQUE,
  order_id text,
  account_id text NOT NULL,
  secid text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('buy', 'sell')),
  order_type text NOT NULL CHECK (order_type IN ('market', 'limit')),
  lots integer NOT NULL CHECK (lots > 0),
  price numeric,
  status text NOT NULL,
  response jsonb NOT NULL
);

CREATE INDEX trade_log_created_idx ON trade_log (created_at DESC);
