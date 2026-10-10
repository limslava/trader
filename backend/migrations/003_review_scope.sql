ALTER TABLE reviews ADD COLUMN scope text NOT NULL DEFAULT 'watchlist' CHECK (scope IN ('watchlist', 'imoex'));
DROP INDEX reviews_created_idx;
CREATE INDEX reviews_scope_created_idx ON reviews (scope, created_at DESC);
