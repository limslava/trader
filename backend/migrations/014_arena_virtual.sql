-- Arena agents trade on virtual accounts inside the app (the broker sandbox allows only 10 accounts per token).
ALTER TABLE arena_agents ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE arena_agents ADD COLUMN cash numeric NOT NULL DEFAULT 0;
UPDATE arena_agents SET cash = start_capital;

CREATE TABLE arena_positions (
  agent_id integer NOT NULL REFERENCES arena_agents (id) ON DELETE CASCADE,
  secid text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  avg_price numeric NOT NULL,
  PRIMARY KEY (agent_id, secid)
);

CREATE TABLE arena_trades (
  id serial PRIMARY KEY,
  agent_id integer NOT NULL REFERENCES arena_agents (id) ON DELETE CASCADE,
  run_id integer REFERENCES arena_runs (id) ON DELETE SET NULL,
  at timestamptz NOT NULL DEFAULT now(),
  secid text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('buy', 'sell')),
  quantity integer NOT NULL CHECK (quantity > 0),
  price numeric NOT NULL,
  amount numeric NOT NULL,
  commission numeric NOT NULL
);
CREATE INDEX arena_trades_agent_idx ON arena_trades (agent_id, at DESC);
