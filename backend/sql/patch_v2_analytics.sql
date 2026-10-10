CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  window_minutes INTEGER NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_tenant_time
  ON analytics_snapshots (tenant_id, created_at DESC);
