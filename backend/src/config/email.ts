import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;

  constructor() {
    this.config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
      from: process.env.SMTP_FROM || 'noreply@russian-trader.ru',
    };

    // В демо-режиме используем тестовый транспортер
    if (process.env.NODE_ENV === 'development' && !this.config.auth.user) {
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
      console.log('📧 Email сервис запущен в демо-режиме (письма не отправляются)');
    } else {
      this.transporter = nodemailer.createTransport(this.config);
      console.log('📧 Email сервис запущен с реальной конфигурацией');
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string, username: string = 'Пользователь'): Promise<boolean> {
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3003'}/auth?token=${resetToken}&mode=forgot-password`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; }
          .token { background: #f0f0f0; padding: 15px; border-radius: 5px; font-family: monospace; word-break: break-all; margin: 15px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Russian Trader</h1>
            <p>Умная платформа для трейдинга</p>
          </div>
          <div class="content">
            <h2>Восстановление пароля</h2>
            <p>Здравствуйте, ${username}!</p>
            <p>Вы запросили сброс пароля для вашего аккаунта Russian Trader.</p>
            
            <p><strong>Ссылка для сброса пароля:</strong></p>
            <a href="${resetLink}" class="button">Сбросить пароль</a>
            
            <p><strong>Или используйте токен:</strong></p>
            <div class="token">${resetToken}</div>
            
            <p>Токен действителен в течение 1 часа.</p>
            <p>Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
            
            <div class="footer">
              <p>Russian Trader © 2025 | Для образовательных целей</p>
              <p>Инвестиции связаны с рисками. Перед началом торговли ознакомьтесь с рисками.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Восстановление пароля для Russian Trader\n\nТокен для сброса пароля: ${resetToken}\n\nСсылка для сброса: ${resetLink}\n\nТокен действителен 1 час.`;

    const options: EmailOptions = {
      to,
      subject: 'Восстановление пароля - Russian Trader',
      html,
      text,
    };

    return this.sendEmail(options);
  }

  async sendWelcomeEmail(to: string, username: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Russian Trader</h1>
            <p>Добро пожаловать в умную платформу для трейдинга!</p>
          </div>
          <div class="content">
            <h2>Добро пожаловать, ${username}!</h2>
            <p>Ваш аккаунт в Russian Trader успешно создан.</p>
            
            <p>Теперь вы можете:</p>
            <ul>
              <li>Анализировать рынки в реальном времени</li>
              <li>Получать персональные рекомендации</li>
              <li>Управлять виртуальным портфелем</li>
              <li>Изучать трейдинг с помощью обучающих материалов</li>
            </ul>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3003'}" class="button">Начать торговлю</a>
            
            <div class="footer">
              <p>Russian Trader © 2025 | Для образовательных целей</p>
              <p>Инвестиции связаны с рисками. Перед началом торговли ознакомьтесь с рисками.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const options: EmailOptions = {
      to,
      subject: 'Добро пожаловать в Russian Trader!',
      html,
    };

    return this.sendEmail(options);
  }

  private async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: this.config.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const info = await this.transporter.sendMail(mailOptions);

      if (process.env.NODE_ENV === 'development' && !this.config.auth.user) {
        // В демо-режиме показываем содержимое письма в логах
        console.log('📧 Демо-письмо (не отправлено):');
        console.log('   Кому:', options.to);
        console.log('   Тема:', options.subject);
        console.log('   Ссылка для сброса:', options.html.match(/href="([^"]+)"/)?.[1] || 'не найдена');
        console.log('   Токен:', options.html.match(/class="token">([^<]+)</)?.[1] || 'не найден');
      } else {
        console.log('📧 Письмо отправлено:', info.messageId);
      }

      return true;
    } catch (error) {
      console.error('❌ Ошибка отправки письма:', error);
      return false;
    }
  }
}

// Синглтон экземпляр
export const emailService = new EmailService();