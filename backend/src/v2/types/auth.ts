export interface AuthTokenPayload {
  userId: string;
  email: string;
  username: string;
  tenantId: string;
  role: string;
}

export interface AuthUserContext {
  userId: string;
  email: string;
  username: string;
  tenantId: string;
  role: string;
}
