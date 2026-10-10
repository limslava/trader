import { Router } from 'express';
import { postgresDatabase } from '../../config/postgres';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticateV2, requireRole(['owner', 'admin', 'trader', 'analyst']), async (req: AuthedRequest, res) => {
  const tenantId = req.auth!.tenantId;

  try {
    const result = await postgresDatabase.query(
      `SELECT
         eo.broker_account_id,
         eo.symbol,
         COALESCE(SUM(CASE WHEN eo.side = 'buy' THEN ef.filled_qty ELSE -ef.filled_qty END), 0) AS net_qty,
         COALESCE(SUM(CASE WHEN eo.side = 'buy' THEN ef.filled_qty * ef.price ELSE 0 END), 0) AS buy_notional,
         COALESCE(SUM(CASE WHEN eo.side = 'buy' THEN ef.filled_qty ELSE 0 END), 0) AS buy_qty,
         COALESCE(SUM(CASE WHEN eo.side = 'sell' THEN ef.filled_qty ELSE 0 END), 0) AS sell_qty
       FROM execution_fills ef
       JOIN execution_orders eo ON eo.id = ef.order_id
       WHERE eo.tenant_id = $1
       GROUP BY eo.broker_account_id, eo.symbol
       ORDER BY eo.symbol`,
      [tenantId]
    );

    const positions = result.rows.map((row: any) => {
      const buyQty = Number(row.buy_qty || 0);
      const buyNotional = Number(row.buy_notional || 0);
      const avgPrice = buyQty > 0 ? buyNotional / buyQty : 0;
      return {
        broker_account_id: row.broker_account_id,
        symbol: row.symbol,
        net_qty: Number(row.net_qty || 0),
        avg_price: avgPrice,
        buy_qty: buyQty,
        sell_qty: Number(row.sell_qty || 0)
      };
    });

    if (positions.length === 0) {
      return res.status(200).json({ positions: [] });
    }

    const symbols = positions.map((pos: any) => pos.symbol);
    const ticksResult = await postgresDatabase.query(
      `SELECT DISTINCT ON (symbol) symbol, price, ts
       FROM market_ticks
       WHERE symbol = ANY($1)
       ORDER BY symbol, ts DESC`,
      [symbols]
    );
    const tickMap = new Map<string, { price: number; ts: number }>();
    for (const row of ticksResult.rows) {
      tickMap.set(String(row.symbol), { price: Number(row.price), ts: Number(row.ts) });
    }

    const enriched = positions.map((pos: any) => {
      const tick = tickMap.get(pos.symbol);
      const lastPrice = tick?.price ?? null;
      const unrealized = lastPrice !== null ? (lastPrice - pos.avg_price) * pos.net_qty : null;
      return {
        ...pos,
        last_price: lastPrice,
        last_ts: tick?.ts ?? null,
        unrealized_pnl: unrealized
      };
    });

    return res.status(200).json({ positions: enriched });
  } catch (error) {
    console.error('Portfolio fetch error:', error);
    return res.status(500).json({ error: 'Internal Error', message: 'Portfolio fetch failed' });
  }
});

export default router;
