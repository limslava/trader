-- Second factor (TOTP) and passkeys (WebAuthn, Face ID / Touch ID) for the single owner account.
CREATE TABLE auth_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  totp_secret_enc text,          -- base32 secret, AES-256-GCM under a key derived from JWT_SECRET
  totp_enabled boolean NOT NULL DEFAULT false,
  totp_last_step bigint NOT NULL DEFAULT 0,  -- an accepted code cannot be replayed within its time step
  failed_logins integer NOT NULL DEFAULT 0,
  locked_until timestamptz
);
INSERT INTO auth_settings (id) VALUES (1);

CREATE TABLE passkeys (
  id serial PRIMARY KEY,
  credential_id text NOT NULL UNIQUE,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  device_type text,
  backed_up boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE TABLE auth_log (
  id serial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL,
  ip text,
  user_agent text
);
