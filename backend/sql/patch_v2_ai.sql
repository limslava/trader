CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES analytics_snapshots(id) ON DELETE SET NULL,
  model VARCHAR(80),
  prompt_version VARCHAR(40),
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_tenant_time
  ON ai_insights (tenant_id, created_at DESC);
