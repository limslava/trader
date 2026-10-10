export type BrokerType = 'paper' | 'tinkoff' | 'sber' | 'alor' | 'finam' | 'unknown';
export type BrokerEnv = 'paper' | 'production' | 'sandbox';

export interface BrokerAccount {
  id: string;
  tenantId: string;
  broker: BrokerType;
  accountNumber: string;
  currency: string;
  isActive: boolean;
  environment: BrokerEnv;
  createdAt: string;
  updatedAt: string;
}
