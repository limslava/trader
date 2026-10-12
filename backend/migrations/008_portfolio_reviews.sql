ALTER TABLE reviews DROP CONSTRAINT reviews_scope_check;
ALTER TABLE reviews ADD CONSTRAINT reviews_scope_check CHECK (scope IN ('watchlist', 'imoex', 'portfolio'));
