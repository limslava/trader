CREATE TABLE reviews (
  id serial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  model text NOT NULL,
  secids text[] NOT NULL,
  result jsonb NOT NULL,
  snapshot jsonb NOT NULL
);

CREATE INDEX reviews_created_idx ON reviews (created_at DESC);
