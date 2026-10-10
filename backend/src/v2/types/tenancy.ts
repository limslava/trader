export type TenantStatus = 'active' | 'suspended' | 'pending';
export type TenantRole = 'owner' | 'admin' | 'trader' | 'analyst' | 'viewer';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TenantMember {
  tenantId: string;
  userId: string;
  role: TenantRole;
  createdAt: string;
}
