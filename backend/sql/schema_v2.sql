-- V2 schema (multi-tenant + execution) - draft

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_members (
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS broker_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  broker VARCHAR(30) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  environment VARCHAR(20) NOT NULL DEFAULT 'paper',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS broker_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_account_id UUID REFERENCES broker_accounts(id) ON DELETE CASCADE,
  secret_ref VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS execution_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  broker_account_id UUID REFERENCES broker_accounts(id) ON DELETE SET NULL,
  broker_order_id TEXT,
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL,
  order_type VARCHAR(20) NOT NULL,
  quantity NUMERIC(20,8) NOT NULL,
  price NUMERIC(20,8),
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS execution_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES execution_orders(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS execution_fills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES execution_orders(id) ON DELETE CASCADE,
  filled_qty NUMERIC(20,8) NOT NULL,
  price NUMERIC(20,8) NOT NULL,
  broker_trade_id VARCHAR(120),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  broker_account_id UUID REFERENCES broker_accounts(id) ON DELETE SET NULL,
  symbol VARCHAR(50) NOT NULL,
  quantity NUMERIC(20,8) NOT NULL,
  avg_price NUMERIC(20,8) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_broker_accounts_tenant ON broker_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_execution_orders_tenant ON execution_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_execution_orders_status ON execution_orders(status);
CREATE INDEX IF NOT EXISTS idx_execution_orders_broker_order_id ON execution_orders(broker_order_id);
CREATE INDEX IF NOT EXISTS idx_execution_fills_order ON execution_fills(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_execution_fills_broker_trade
  ON execution_fills(order_id, broker_trade_id)
  WHERE broker_trade_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_positions_tenant ON positions(tenant_id);
