import { Router } from 'express';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';
import { CryptoExecutionService } from '../services/crypto/CryptoExecutionService';
import { isLiveTradingEnabled } from '../config/tradingMode';

const router = Router();
const cryptoExec = new CryptoExecutionService();

router.post('/orders', authenticateV2, requireRole(['owner', 'admin', 'trader']), async (req: AuthedRequest, res) => {
  if (!isLiveTradingEnabled()) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Crypto execution is disabled unless TRADING_MODE=live and ENABLE_LIVE_TRADING=true'
    });
  }

  const { exchange, brokerAccountId, symbol, side, type, quantity, price } = req.body || {};
  if (!exchange || !brokerAccountId || !symbol || !side || !type || !quantity) {
    return res.status(400).json({ error: 'Bad Request', message: 'exchange, brokerAccountId, symbol, side, type, quantity required' });
  }

  const response = await cryptoExec.placeOrder(req.auth!.tenantId, brokerAccountId, String(exchange), {
    symbol: String(symbol),
    side,
    type,
    quantity: Number(quantity),
    price: price ? Number(price) : undefined
  });

  return res.status(200).json({ result: response });
});

export default router;
