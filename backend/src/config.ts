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
