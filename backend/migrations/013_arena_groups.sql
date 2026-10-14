-- Several tournaments side by side: the original mix, "models" (one persona on every model) and
-- "styles" (every persona on every model).
ALTER TABLE arena_agents ADD COLUMN group_key text NOT NULL DEFAULT 'main';
CREATE INDEX arena_agents_group_idx ON arena_agents (group_key, id);
