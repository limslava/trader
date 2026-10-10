import { postgresDatabase } from '../../config/postgres';

export interface TenantPolicy {
  execution: {
    maxAttempts: number;
    baseDelayMs: number;
    maxQueued: number;
  };
  risk: {
    maxNotional: number | null;
    maxDailyNotional: number | null;
    maxOpenNotional: number | null;
    maxQtyPerOrder: number | null;
    maxOpenOrders: number | null;
    maxDailyOrders: number | null;
    maxOpenQtyPerSymbol: number | null;
    maxOpenNotionalPerSymbol: number | null;
    maxPositionQtyPerSymbol: number | null;
  };
}

const defaultPolicy: TenantPolicy = {
  execution: {
    maxAttempts: 5,
    baseDelayMs: 250,
    maxQueued: 1000
  },
  risk: {
    maxNotional: null,
    maxDailyNotional: null,
    maxOpenNotional: null,
    maxQtyPerOrder: null,
    maxOpenOrders: null,
    maxDailyOrders: null,
    maxOpenQtyPerSymbol: null,
    maxOpenNotionalPerSymbol: null,
    maxPositionQtyPerSymbol: null
  }
};

export class TenantPolicyService {
  async getPolicy(tenantId: string): Promise<TenantPolicy> {
    const result = await postgresDatabase.query(
      'SELECT policy FROM tenant_policies WHERE tenant_id = $1',
      [tenantId]
    );

    if (result.rows.length === 0) return defaultPolicy;

    const policy = result.rows[0].policy || {};
    return {
      execution: {
        maxAttempts: policy.execution?.maxAttempts ?? defaultPolicy.execution.maxAttempts,
        baseDelayMs: policy.execution?.baseDelayMs ?? defaultPolicy.execution.baseDelayMs,
        maxQueued: policy.execution?.maxQueued ?? defaultPolicy.execution.maxQueued
      },
      risk: {
        maxNotional: policy.risk?.maxNotional ?? defaultPolicy.risk.maxNotional,
        maxDailyNotional: policy.risk?.maxDailyNotional ?? defaultPolicy.risk.maxDailyNotional,
        maxOpenNotional: policy.risk?.maxOpenNotional ?? defaultPolicy.risk.maxOpenNotional,
        maxQtyPerOrder: policy.risk?.maxQtyPerOrder ?? defaultPolicy.risk.maxQtyPerOrder,
        maxOpenOrders: policy.risk?.maxOpenOrders ?? defaultPolicy.risk.maxOpenOrders,
        maxDailyOrders: policy.risk?.maxDailyOrders ?? defaultPolicy.risk.maxDailyOrders,
        maxOpenQtyPerSymbol: policy.risk?.maxOpenQtyPerSymbol ?? defaultPolicy.risk.maxOpenQtyPerSymbol,
        maxOpenNotionalPerSymbol:
          policy.risk?.maxOpenNotionalPerSymbol ?? defaultPolicy.risk.maxOpenNotionalPerSymbol,
        maxPositionQtyPerSymbol:
          policy.risk?.maxPositionQtyPerSymbol ?? defaultPolicy.risk.maxPositionQtyPerSymbol
      }
    };
  }
}
