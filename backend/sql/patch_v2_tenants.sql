CREATE TABLE IF NOT EXISTS tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer',
  token VARCHAR(120) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_tenant ON tenant_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_email ON tenant_invitations(email);
