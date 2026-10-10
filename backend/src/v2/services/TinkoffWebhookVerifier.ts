import crypto from 'crypto';

export class TinkoffWebhookVerifier {
  verify(body: string, signature: string | undefined, secret: string | undefined): boolean {
    if (!signature || !secret) return false;
    const digest = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  }
}
