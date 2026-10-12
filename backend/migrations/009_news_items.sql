-- Headlines from primary RSS feeds, matched to tickers and classified once (event type, tone, impact).
CREATE TABLE news_items (
  url text PRIMARY KEY,
  title text NOT NULL,
  source text NOT NULL,
  published_at timestamptz NOT NULL,
  tickers text[] NOT NULL DEFAULT '{}',
  market boolean NOT NULL DEFAULT false,
  event text NOT NULL DEFAULT 'other',
  sentiment numeric,
  impact text,
  classified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX news_items_published_idx ON news_items (published_at DESC);
CREATE INDEX news_items_tickers_idx ON news_items USING gin (tickers);
