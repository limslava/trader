import { TenantPolicyService } from './TenantPolicyService';
import { postgresDatabase } from '../../config/postgres';

export interface PreTradeCheckInput {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price?: number | null;
  tenantId: string;
}

export interface PreTradeCheckResult {
  allowed: boolean;
  reasons: string[];
}

export class RiskService {
  private policyService = new TenantPolicyService();

  async preTradeCheck(input: PreTradeCheckInput): Promise<PreTradeCheckResult> {
    // TODO: Replace with portfolio-aware checks and broker limits
    if (!input.symbol || input.quantity <= 0) {
      return { allowed: false, reasons: ['Invalid order parameters'] };
    }

    const policy = await this.policyService.getPolicy(input.tenantId);
    const reasons: string[] = [];
    const price = input.price ?? null;

    if (policy.risk.maxQtyPerOrder && input.quantity > policy.risk.maxQtyPerOrder) {
      reasons.push('Max quantity per order exceeded');
    }

    const requiresNotional =
      policy.risk.maxNotional ||
      policy.risk.maxDailyNotional ||
      policy.risk.maxOpenNotional ||
      policy.risk.maxOpenNotionalPerSymbol;

    if (requiresNotional && !price) {
      reasons.push('Price required for notional risk checks');
    }

    if (price) {
      const notional = input.quantity * price;
      if (policy.risk.maxNotional && notional > policy.risk.maxNotional) {
        reasons.push('Max notional exceeded');
      }

      if (policy.risk.maxDailyNotional) {
        const daily = await this.sumNotional(
          input.tenantId,
          `created_at::date = CURRENT_DATE AND status NOT IN ('rejected', 'cancelled')`
        );
        if (daily + notional > policy.risk.maxDailyNotional) {
          reasons.push('Max daily notional exceeded');
        }
      }

      if (policy.risk.maxOpenNotional) {
        const open = await this.sumNotional(
          input.tenantId,
          `status IN ('new', 'queued', 'accepted', 'partially_filled')`
        );
        if (open + notional > policy.risk.maxOpenNotional) {
          reasons.push('Max open notional exceeded');
        }
      }

      if (policy.risk.maxOpenNotionalPerSymbol) {
        const openSymbol = await this.sumNotional(
          input.tenantId,
          `status IN ('new', 'queued', 'accepted', 'partially_filled') AND symbol = $2`,
          [input.symbol]
        );
        if (openSymbol + notional > policy.risk.maxOpenNotionalPerSymbol) {
          reasons.push('Max open notional per symbol exceeded');
        }
      }
    }

    if (policy.risk.maxOpenOrders) {
      const openOrders = await this.countOrders(
        input.tenantId,
        `status IN ('new', 'queued', 'accepted', 'partially_filled')`
      );
      if (openOrders + 1 > policy.risk.maxOpenOrders) {
        reasons.push('Max open orders exceeded');
      }
    }

    if (policy.risk.maxDailyOrders) {
      const dailyOrders = await this.countOrders(
        input.tenantId,
        `created_at::date = CURRENT_DATE AND status NOT IN ('rejected', 'cancelled')`
      );
      if (dailyOrders + 1 > policy.risk.maxDailyOrders) {
        reasons.push('Max daily orders exceeded');
      }
    }

    if (policy.risk.maxOpenQtyPerSymbol) {
      const openQty = await this.sumQty(
        input.tenantId,
        `status IN ('new', 'queued', 'accepted', 'partially_filled') AND symbol = $2`,
        [input.symbol]
      );
      if (openQty + input.quantity > policy.risk.maxOpenQtyPerSymbol) {
        reasons.push('Max open qty per symbol exceeded');
      }
    }

    if (policy.risk.maxPositionQtyPerSymbol) {
      const netQty = await this.netFilledQty(input.tenantId, input.symbol);
      const delta = input.side === 'buy' ? input.quantity : -input.quantity;
      if (Math.abs(netQty + delta) > policy.risk.maxPositionQtyPerSymbol) {
        reasons.push('Max position qty per symbol exceeded');
      }
    }

    return { allowed: reasons.length === 0, reasons };
  }

  private async sumNotional(tenantId: string, whereClause: string, extraParams: any[] = []): Promise<number> {
    const result = await postgresDatabase.query(
      `SELECT COALESCE(SUM(quantity * price), 0) AS total
       FROM execution_orders
       WHERE tenant_id = $1
         AND price IS NOT NULL
         AND ${whereClause}`,
      [tenantId, ...extraParams]
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  private async sumQty(tenantId: string, whereClause: string, extraParams: any[] = []): Promise<number> {
    const result = await postgresDatabase.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total
       FROM execution_orders
       WHERE tenant_id = $1
         AND ${whereClause}`,
      [tenantId, ...extraParams]
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  private async countOrders(tenantId: string, whereClause: string, extraParams: any[] = []): Promise<number> {
    const result = await postgresDatabase.query(
      `SELECT COUNT(*)::int AS total
       FROM execution_orders
       WHERE tenant_id = $1
         AND ${whereClause}`,
      [tenantId, ...extraParams]
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  private async netFilledQty(tenantId: string, symbol: string): Promise<number> {
    const result = await postgresDatabase.query(
      `SELECT COALESCE(SUM(CASE WHEN eo.side = 'buy' THEN ef.filled_qty ELSE -ef.filled_qty END), 0) AS net_qty
       FROM execution_fills ef
       JOIN execution_orders eo ON eo.id = ef.order_id
       WHERE eo.tenant_id = $1 AND eo.symbol = $2`,
      [tenantId, symbol]
    );
    return Number(result.rows[0]?.net_qty ?? 0);
  }
}
