import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().min(1).default('postgresql://trader:trader@localhost:5440/trader'),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),

  // Single-user auth: the app is a personal tool, so one password is enough.
  APP_PASSWORD: z.string().min(8, 'APP_PASSWORD must be at least 8 characters'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // Any OpenAI-compatible chat completions API (DeepSeek, OpenRouter, OpenAI, local Ollama...).
  AI_API_KEY: z.string().default(''),
  AI_BASE_URL: z.string().url().default('https://api.deepseek.com'),
  AI_MODEL: z.string().default('deepseek-chat'),
  // Local Ollama for Arena agents (model names are written as "ollama/<name>"). No key needed.
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),

  // T-Invest API token (Т-Инвестиции): dividends, fundamentals, sandbox trading. Optional.
  TINKOFF_TOKEN: z.string().default(''),
  // true: sandbox contour (needs a Sandbox token); false: production (read-only or full-access token).
  TINKOFF_SANDBOX: z.enum(['true', 'false']).default('true'),

  // Optional weekly digest to Telegram (bot from @BotFather, chat id of your own chat with it).
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_CHAT_ID: z.string().default(''),

  MOEX_ISS_URL: z.string().url().default('https://iss.moex.com/iss'),
  STATIC_DIR: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const config = parsed.data;
export const isProd = config.NODE_ENV === 'production';
