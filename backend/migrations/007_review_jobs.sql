-- Reviews run as background jobs: the row is created first, filled in when the model answers.
ALTER TABLE reviews
  ADD COLUMN status text NOT NULL DEFAULT 'done' CHECK (status IN ('running', 'done', 'failed')),
  ADD COLUMN error text,
  ALTER COLUMN result SET DEFAULT '{}',
  ALTER COLUMN snapshot SET DEFAULT '[]';
