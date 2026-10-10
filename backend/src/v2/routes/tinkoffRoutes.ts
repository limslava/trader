import { Router } from 'express';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';
import { TinkoffInstrumentsService } from '../services/broker/TinkoffInstrumentsService';
import { TinkoffOrderStatusService } from '../services/broker/TinkoffOrderStatusService';
import { TinkoffOrderStateService } from '../services/broker/TinkoffOrderStateService';
import { TinkoffSandboxService } from '../services/broker/TinkoffSandboxService';
import { postgresDatabase } from '../../config/postgres';
import { secretStore } from '../services/secrets/SecretStore';
import { SecretRegistry } from '../services/secrets/SecretRegistry';
import axios from 'axios';
import https from 'https';

const router = Router();
const instruments = new TinkoffInstrumentsService();
const orders = new TinkoffOrderStatusService();
const orderState = new TinkoffOrderStateService();
const sandbox = new TinkoffSandboxService();
const registry = new SecretRegistry();
const httpsAgent = process.env.TINKOFF_ALLOW_INSECURE === 'true'
  ? new https.Agent({ rejectUnauthorized: false })
  : undefined;

router.post('/sync-instruments', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { brokerAccountId } = req.body || {};
  if (!brokerAccountId) {
    return res.status(400).json({ error: 'Bad Request', message: 'brokerAccountId required' });
  }

  try {
    const count = await instruments.syncStocks(req.auth!.tenantId, brokerAccountId);
    return res.status(200).json({ synced: count });
  } catch (error: any) {
    console.error('Tinkoff sync instruments error:', error?.response?.data || error);
    return res.status(500).json({ error: 'Sync failed', message: error?.message || 'Tinkoff sync failed' });
  }
});

router.post('/sync-instruments-full', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { brokerAccountId } = req.body || {};
  if (!brokerAccountId) {
    return res.status(400).json({ error: 'Bad Request', message: 'brokerAccountId required' });
  }

  try {
    const started = Date.now();
    const count = await instruments.syncStocksFull(req.auth!.tenantId, brokerAccountId);
    const ms = Date.now() - started;
    console.log(`Tinkoff full sync completed: ${count} instruments in ${ms}ms`);
    return res.status(200).json({ synced: count });
  } catch (error: any) {
    console.error('Tinkoff sync instruments full error:', error?.response?.data || error);
    return res.status(500).json({ error: 'Sync failed', message: error?.message || 'Tinkoff full sync failed' });
  }
});

router.post('/sync-futures', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { brokerAccountId } = req.body || {};
  if (!brokerAccountId) {
    return res.status(400).json({ error: 'Bad Request', message: 'brokerAccountId required' });
  }

  try {
    const count = await instruments.syncFutures(req.auth!.tenantId, brokerAccountId);
    return res.status(200).json({ synced: count });
  } catch (error: any) {
    return res.status(500).json({ error: 'Sync failed', message: error?.message || 'Tinkoff sync futures failed' });
  }
});

router.post('/sync-options', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { brokerAccountId } = req.body || {};
  if (!brokerAccountId) {
    return res.status(400).json({ error: 'Bad Request', message: 'brokerAccountId required' });
  }

  try {
    const count = await instruments.syncOptions(req.auth!.tenantId, brokerAccountId);
    return res.status(200).json({ synced: count });
  } catch (error: any) {
    return res.status(500).json({ error: 'Sync failed', message: error?.message || 'Tinkoff sync options failed' });
  }
});

router.post('/sync-orders', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { brokerAccountId } = req.body || {};
  if (!brokerAccountId) {
    return res.status(400).json({ error: 'Bad Request', message: 'brokerAccountId required' });
  }

  try {
    const count = await orders.syncOrders(req.auth!.tenantId, brokerAccountId);
    return res.status(200).json({ updated: count });
  } catch (error: any) {
    return res.status(500).json({ error: 'Sync failed', message: error?.message || 'Tinkoff sync orders failed' });
  }
});

router.post('/sync-order-state', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { brokerAccountId, orderId } = req.body || {};
  if (!brokerAccountId || !orderId) {
    return res.status(400).json({ error: 'Bad Request', message: 'brokerAccountId and orderId required' });
  }

  try {
    const updated = await orderState.syncOrderState(req.auth!.tenantId, brokerAccountId, orderId);
    return res.status(200).json({ updated });
  } catch (error: any) {
    return res.status(500).json({ error: 'Sync failed', message: error?.message || 'Tinkoff sync order state failed' });
  }
});

router.post('/sandbox/setup', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { name, payInAmount, currency, attachCredential } = req.body || {};
  const token = process.env.TINKOFF_INVEST_TOKEN;
  if (!token) {
    return res.status(400).json({ error: 'Bad Request', message: 'TINKOFF_INVEST_TOKEN is missing' });
  }

  let baseUrl = process.env.TINKOFF_API_URL || 'https://invest-public-api.tbank.ru/rest/';
  let usedInstrumentId: string | null = null;

  try {
    const accountId = await sandbox.openAccount(token, name || 'Sandbox account');
    if (Number.isFinite(Number(payInAmount))) {
      await sandbox.payIn(token, accountId, Number(payInAmount), currency || 'RUB');
    }

    const tenantId = req.auth!.tenantId;
    const account = await postgresDatabase.query(
      `INSERT INTO broker_accounts
       (tenant_id, broker, account_number, currency, environment, is_active, created_at, updated_at)
       VALUES ($1, 'tinkoff', $2, $3, 'sandbox', TRUE, NOW(), NOW())
       RETURNING id, tenant_id, broker, account_number, currency, environment, is_active, created_at, updated_at`,
      [tenantId, accountId, currency || 'RUB']
    );

    if (attachCredential !== false) {
      const ref = await secretStore.put(tenantId, token);
      await registry.register(tenantId, account.rows[0].id, ref);
    }

    return res.status(201).json({ account: account.rows[0] });
  } catch (error: any) {
    console.error('Tinkoff sandbox setup error:', error?.response?.data || error);
    return res.status(500).json({
      error: 'Sandbox setup failed',
      message: error?.response?.data?.message || error?.message || 'Sandbox setup failed'
    });
  }
});

router.post('/validate-instrument', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { brokerAccountId, symbol } = req.body || {};
  if (!brokerAccountId || !symbol) {
    return res.status(400).json({ error: 'Bad Request', message: 'brokerAccountId and symbol required' });
  }

  const token = process.env.TINKOFF_INVEST_TOKEN;
  if (!token) {
    return res.status(400).json({ error: 'Bad Request', message: 'TINKOFF_INVEST_TOKEN is missing' });
  }

  let baseUrl = process.env.TINKOFF_API_URL || 'https://invest-public-api.tbank.ru/rest/';
  let usedInstrumentId: string | null = null;
  try {
    const accountResult = await postgresDatabase.query(
      `SELECT environment
       FROM broker_accounts
       WHERE id = $1 AND tenant_id = $2`,
      [brokerAccountId, req.auth!.tenantId]
    );
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Broker account not found' });
    }

    const environment = accountResult.rows[0]?.environment;
    const baseUrl = environment === 'sandbox' || process.env.TINKOFF_SANDBOX === 'true'
      ? (process.env.TINKOFF_SANDBOX_API_URL || 'https://sandbox-invest-public-api.tbank.ru/rest/')
      : (process.env.TINKOFF_API_URL || 'https://invest-public-api.tbank.ru/rest/');

    const url = `${baseUrl}tinkoff.public.invest.api.contract.v1.InstrumentsService/FindInstrument`;
    const response = await axios.post(url, { query: String(symbol).toUpperCase() }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000,
      httpsAgent
    });

    const instruments = response.data?.instruments || [];
    if (instruments.length > 0) {
      const first = instruments[0];
      const resolvedSymbol = String(first.ticker || req.body?.symbol).toUpperCase();
      const instrumentId = first.uid || first.figi || null;
      if (instrumentId) {
        await postgresDatabase.query(
          `INSERT INTO instruments (exchange, symbol, name, lot_size, tick_size, currency, instrument_id, created_at, updated_at)
           VALUES ('MOEX', $1, $2, $3, $4, $5, $6, NOW(), NOW())
           ON CONFLICT (exchange, symbol)
           DO UPDATE SET instrument_id = EXCLUDED.instrument_id,
                         name = COALESCE(EXCLUDED.name, instruments.name),
                         currency = COALESCE(EXCLUDED.currency, instruments.currency),
                         updated_at = NOW()`,
          [
            resolvedSymbol,
            first.name || null,
            first.lot || 1,
            first.minPriceIncrement?.units ? Number(first.minPriceIncrement.units) : 0.01,
            first.currency || 'RUB',
            instrumentId
          ]
        );
      }
    }
    return res.status(200).json({ instruments });
  } catch (error: any) {
    console.error('Tinkoff validate instrument error:', error?.response?.data || error);
    return res.status(500).json({ error: 'Validation failed', message: error?.message || 'Validate instrument failed' });
  }
});

router.post('/trading-status', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { brokerAccountId, symbol } = req.body || {};
  if (!brokerAccountId || !symbol) {
    return res.status(400).json({ error: 'Bad Request', message: 'brokerAccountId and symbol required' });
  }

  const token = process.env.TINKOFF_INVEST_TOKEN;
  if (!token) {
    return res.status(400).json({ error: 'Bad Request', message: 'TINKOFF_INVEST_TOKEN is missing' });
  }

  let baseUrl = process.env.TINKOFF_API_URL || 'https://invest-public-api.tbank.ru/rest/';
  let usedInstrumentId: string | null = null;

  try {
    const accountResult = await postgresDatabase.query(
      `SELECT environment
       FROM broker_accounts
       WHERE id = $1 AND tenant_id = $2`,
      [brokerAccountId, req.auth!.tenantId]
    );
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Broker account not found' });
    }

    const environment = accountResult.rows[0]?.environment;
    const sandboxBase = process.env.TINKOFF_SANDBOX_API_URL || 'https://sandbox-invest-public-api.tbank.ru/rest/';
    const prodBase = process.env.TINKOFF_API_URL || 'https://invest-public-api.tbank.ru/rest/';
    const isSandbox = environment === 'sandbox' || process.env.TINKOFF_SANDBOX === 'true';
    baseUrl = isSandbox ? sandboxBase : prodBase;

    let instrumentId: string | null = null;
    let instrumentMeta: any = null;
    const findUrl = `${baseUrl}tinkoff.public.invest.api.contract.v1.InstrumentsService/FindInstrument`;
    const findResp = await axios.post(findUrl, { query: String(symbol).toUpperCase() }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000,
      httpsAgent
    });

    const instruments = findResp.data?.instruments || [];
    if (!instruments.length) {
      return res.status(404).json({ error: 'Not Found', message: 'Instrument not found' });
    }

    const first = instruments[0];
    instrumentId = first.uid || null;
    instrumentMeta = first;
    if (!instrumentId) {
      return res.status(404).json({ error: 'Not Found', message: 'Instrument id missing' });
    }

    const statusUrl = `${baseUrl}tinkoff.public.invest.api.contract.v1.InstrumentsService/GetTradingStatus`;
    const requestStatus = async (id: string) => {
      return axios.post(statusUrl, { instrumentId: id }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000,
        httpsAgent
      });
    };

    try {
      usedInstrumentId = instrumentId as string;
      const statusResp = await requestStatus(usedInstrumentId);
      return res.status(200).json({
        instrument: {
          ticker: instrumentMeta?.ticker || String(symbol).toUpperCase(),
          classCode: instrumentMeta?.classCode || instrumentMeta?.class_code,
          uid: instrumentMeta?.uid,
          figi: instrumentMeta?.figi,
          instrumentId: usedInstrumentId
        },
        tradingStatus: statusResp.data
      });
    } catch (error: any) {
      const code = error?.response?.data?.code;
      if (code === 5 && isSandbox) {
        if (process.env.TINKOFF_TRADING_STATUS_USE_PROD === 'true') {
          try {
            const prodBase = process.env.TINKOFF_API_URL || 'https://invest-public-api.tbank.ru/rest/';
            const prodFindUrl = `${prodBase}tinkoff.public.invest.api.contract.v1.InstrumentsService/FindInstrument`;
            const prodFind = await axios.post(prodFindUrl, { query: String(symbol).toUpperCase() }, {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              timeout: 15000,
              httpsAgent
            });
            const prodFirst = prodFind.data?.instruments?.[0];
            const prodUid = prodFirst?.uid || null;
            if (prodUid) {
              const prodStatusUrl = `${prodBase}tinkoff.public.invest.api.contract.v1.InstrumentsService/GetTradingStatus`;
              const statusResp = await axios.post(prodStatusUrl, { instrumentId: prodUid }, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                timeout: 15000,
                httpsAgent
              });
              return res.status(200).json({
                instrument: {
                  ticker: prodFirst.ticker || String(symbol).toUpperCase(),
                  classCode: prodFirst.classCode || prodFirst.class_code,
                  uid: prodFirst.uid,
                  figi: prodFirst.figi,
                  instrumentId: prodUid
                },
                tradingStatus: statusResp.data,
                note: 'Trading status fetched from prod contour'
              });
            }
          } catch (_error) {
            // fall through to main error handling
          }
        }

        return res.status(200).json({
          instrument: {
            ticker: instrumentMeta?.ticker || String(symbol).toUpperCase(),
            classCode: instrumentMeta?.classCode || instrumentMeta?.class_code,
            uid: instrumentMeta?.uid,
            figi: instrumentMeta?.figi,
            instrumentId: usedInstrumentId || instrumentId || null
          },
          tradingStatus: null,
          note: 'Trading status not available in sandbox (code 5)'
        });
      }
      console.error('Tinkoff trading status debug', {
        baseUrl,
        instrumentId: usedInstrumentId || instrumentId || null,
        symbol: String(symbol).toUpperCase(),
        error: error?.response?.data || error?.message || error
      });
      throw error;
    }
  } catch (error: any) {
    console.error('Tinkoff trading status error:', error?.response?.data || error);
    return res.status(500).json({
      error: 'Trading status failed',
      message: error?.response?.data?.message || error?.message || 'Trading status failed',
      details: {
        ...(error?.response?.data || {}),
        baseUrl,
        instrumentId: usedInstrumentId || null
      }
    });
  }
});

export default router;
