import axios from 'axios';
import { postgresDatabase } from '../../config/postgres';

const DEEPSEEK_API_BASE = (process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com').replace(/\/+$/, '');
const DEEPSEEK_CHAT_PATH = DEEPSEEK_API_BASE.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions';
const DEEPSEEK_API_URL = `${DEEPSEEK_API_BASE}${DEEPSEEK_CHAT_PATH}`;

export class AIInsightsService {
  private model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  private promptVersion = 'v1';

  async generateInsights(tenantId: string, snapshot: any, snapshotId?: string | null): Promise<any> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY is missing');
    }

    const baseSystem = [
      'You are a trading analytics assistant.',
      'Return ONLY valid JSON with this schema:',
      '{"status":"ok|insufficient_data","summary":"string","insights":["string"],"risks":["string"],"confidence":0-1}.',
      'Do not provide direct buy/sell commands.',
      'Focus on diagnostics, risk, and execution quality.',
      'If data is insufficient, respond with status="insufficient_data".',
      'If there is any order activity (orders count > 0), you MUST return status="ok".',
      'If there are zero fills but accepted orders exist, still return status="ok" and explain the execution gap.'
      ,
      'If status="ok", provide 2-5 insights and 2-5 risks. Each item must be specific and reference snapshot numbers (counts, prices, rates, time window).',
      'If status="insufficient_data", keep insights/risks empty arrays and explain what is missing in summary.',
      'Avoid generic statements. Prefer concise, data-grounded bullets.'
    ].join(' ');

    const facts = this.buildFacts(snapshot);

    const buildMessages = (strictJson: boolean, forceOk: boolean) => [
      {
        role: 'system',
        content: strictJson
          ? `${baseSystem} Return JSON only. Do not wrap in markdown. Do not include extra text.`
          : baseSystem
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'Analyze the snapshot and provide concise insights.',
          facts,
          instructions: forceOk
            ? 'There is order activity. Use status="ok" and provide specific insights/risks.'
            : undefined,
          snapshot
        })
      }
    ];

    const call = async (strictJson: boolean, forceOk: boolean) => {
      return axios.post(
        DEEPSEEK_API_URL,
        {
          model: this.model,
          messages: buildMessages(strictJson, forceOk),
          temperature: 0.2
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 20000
        }
      );
    };

    const forceOk = this.hasOrderActivity(snapshot);
    const response = await call(false, forceOk);
    const outputText = response.data?.choices?.[0]?.message?.content || '';
    let payload = this.parsePayload(outputText);

    if (payload.status === 'invalid_json' || payload.status === 'invalid_schema') {
      const retry = await call(true, forceOk);
      const retryText = retry.data?.choices?.[0]?.message?.content || '';
      payload = this.parsePayload(retryText);
    }

    if (payload.status === 'insufficient_data' && forceOk) {
      const retry = await call(true, true);
      const retryText = retry.data?.choices?.[0]?.message?.content || '';
      payload = this.parsePayload(retryText);
    }

    const saved = await postgresDatabase.query(
      `INSERT INTO ai_insights (tenant_id, snapshot_id, model, prompt_version, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, created_at`,
      [tenantId, snapshotId || null, this.model, this.promptVersion, JSON.stringify(payload)]
    );

    return {
      id: saved.rows[0]?.id,
      createdAt: saved.rows[0]?.created_at,
      model: this.model,
      promptVersion: this.promptVersion,
      payload
    };
  }

  async listInsights(tenantId: string, limit = 20): Promise<any[]> {
    const result = await postgresDatabase.query(
      `SELECT id, snapshot_id, model, prompt_version, payload, created_at
       FROM ai_insights
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );
    return result.rows;
  }

  private isValidPayload(payload: any): boolean {
    if (!payload || typeof payload !== 'object') return false;
    if (payload.status !== 'ok' && payload.status !== 'insufficient_data') return false;
    if (!Array.isArray(payload.insights) || !payload.insights.every((item: any) => typeof item === 'string'))
      return false;
    if (!Array.isArray(payload.risks) || !payload.risks.every((item: any) => typeof item === 'string')) return false;
    if (typeof payload.summary !== 'string') return false;
    if (payload.confidence !== undefined) {
      if (typeof payload.confidence !== 'number') return false;
      if (payload.confidence < 0 || payload.confidence > 1) return false;
    }
    return true;
  }

  private stripMarkdownJson(text: string): string {
    const trimmed = String(text || '').trim();
    if (trimmed.startsWith('```')) {
      return trimmed
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/i, '')
        .trim();
    }
    return trimmed;
  }

  private hasOrderActivity(snapshot: any): boolean {
    const orders = snapshot?.orders;
    if (!Array.isArray(orders)) return false;
    return orders.some((item: any) => Number(item?.count || 0) > 0);
  }

  private buildFacts(snapshot: any): Record<string, any> {
    const windowMinutes = snapshot?.windowMinutes;
    const orders = Array.isArray(snapshot?.orders) ? snapshot.orders : [];
    const fills = snapshot?.fills || {};
    const avgOrderPrice = snapshot?.avgOrderPrice;
    return {
      windowMinutes,
      orders,
      avgOrderPrice,
      fills: {
        totalQty: fills?.totalQty ?? 0,
        totalNotional: fills?.totalNotional ?? 0,
        avgPrice: fills?.avgPrice ?? 0
      }
    };
  }

  private parsePayload(text: string): any {
    const cleaned = this.stripMarkdownJson(text);
    let payload: any = { status: 'invalid_json', raw: text };
    try {
      const parsed = JSON.parse(cleaned);
      if (this.isValidPayload(parsed)) {
        payload = parsed;
      } else {
        payload = { status: 'invalid_schema', raw: parsed };
      }
    } catch (_error) {
      // keep raw text
    }
    return payload;
  }
}
