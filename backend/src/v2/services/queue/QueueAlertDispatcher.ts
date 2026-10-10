import nodemailer from 'nodemailer';
import axios from 'axios';

export class QueueAlertDispatcher {
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    } : undefined
  });

  async dispatch(message: string): Promise<void> {
    await Promise.all([
      this.withRetry(() => this.sendEmail(message)),
      this.withRetry(() => this.sendSlack(message)),
      this.withRetry(() => this.sendTelegram(message))
    ]);
  }

  private async withRetry(fn: () => Promise<void>, attempts = 3, baseDelayMs = 500): Promise<void> {
    let lastError: any;
    for (let i = 0; i < attempts; i += 1) {
      try {
        await fn();
        return;
      } catch (error) {
        lastError = error;
        if (i < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (i + 1)));
        }
      }
    }
    if (lastError) {
      console.warn('[QueueAlertDispatcher] dispatch failed', lastError);
    }
  }

  private async sendEmail(message: string): Promise<void> {
    const to = process.env.ALERT_EMAIL_TO;
    if (!to) return;

    await this.transporter.sendMail({
      from: process.env.ALERT_EMAIL_FROM || 'alerts@russian-trader.local',
      to,
      subject: 'Queue Alert',
      text: message
    });
  }

  private async sendSlack(message: string): Promise<void> {
    const webhook = process.env.SLACK_WEBHOOK_URL;
    if (!webhook) return;
    await axios.post(webhook, { text: message }, { timeout: 5000 });
  }

  private async sendTelegram(message: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message
    }, { timeout: 5000 });
  }
}
