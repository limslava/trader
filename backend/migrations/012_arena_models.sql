-- Which model made each decision, so runs stay comparable after an agent switches models.
ALTER TABLE arena_runs ADD COLUMN model text;
