import nodemailer from 'nodemailer';

export class TenantInvitationMailer {
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    } : undefined
  });

  async send(email: string, token: string): Promise<void> {
    const from = process.env.ALERT_EMAIL_FROM || 'alerts@russian-trader.local';
    const subject = 'Tenant Invitation';
    const text = `You were invited to join a tenant. Use token: ${token}`;

    if (!process.env.SMTP_HOST || !process.env.ALERT_EMAIL_TO) {
      console.log(`[INVITE] Send invitation to ${email} with token ${token}`);
      return;
    }

    await this.transporter.sendMail({ from, to: email, subject, text });
  }
}
