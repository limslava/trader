-- Arena: autonomous AI agents, each trading its own sandbox account.
CREATE TABLE arena_agents (
  id serial PRIMARY KEY,
  name text NOT NULL,
  persona text NOT NULL,
  model text,
  account_id text NOT NULL UNIQUE,
  start_capital numeric NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'stopped')),
  stop_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per decision session: what the model proposed, what the risk layer let through, and the outcome.
CREATE TABLE arena_runs (
  id serial PRIMARY KEY,
  agent_id integer NOT NULL REFERENCES arena_agents (id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed')),
  error text,
  equity_before numeric,
  market_view text,
  reasoning text,
  proposed jsonb NOT NULL DEFAULT '[]',
  executed jsonb NOT NULL DEFAULT '[]'
);
CREATE INDEX arena_runs_agent_idx ON arena_runs (agent_id, started_at DESC);

-- Daily equity curve for the leaderboard (drawdown, Sharpe).
CREATE TABLE arena_snapshots (
  agent_id integer NOT NULL REFERENCES arena_agents (id) ON DELETE CASCADE,
  day date NOT NULL,
  equity numeric NOT NULL,
  cash numeric NOT NULL,
  imoex numeric,
  PRIMARY KEY (agent_id, day)
);

CREATE TABLE arena_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  paused boolean NOT NULL DEFAULT false
);
INSERT INTO arena_settings (id) VALUES (1);
