# Trader

Личное веб-приложение для AI-анализа акций и БПИФ Московской биржи.

- **Поиск и вотчлист** — любые акции и фонды с режима TQBR, котировки обновляются каждые 30 секунд.
- **Графики** — свечи с объёмом: неделя, месяц, полгода, год, 5 лет.
- **Индикаторы** — SMA 50/200, RSI, MACD, ATR, волатильность, доходность за периоды, 52-недельный диапазон, оборот.
- **AI-анализ** — сигнал (покупать / держать / продавать) с уверенностью, аргументы за и против, риски, уровни поддержки и сопротивления (рисуются на графике), условия пересмотра. Можно задать свой вопрос. Вся история анализов сохраняется.

Данные берутся из бесплатного [MOEX ISS](https://iss.moex.com) (задержка до 15 минут). AI — любой OpenAI-совместимый API, по умолчанию DeepSeek.

> AI-анализ строится только на технических данных и не является инвестиционной рекомендацией.

## Стек

| | |
|---|---|
| Backend | Node.js 22+, Express 5, PostgreSQL, zod |
| Frontend | React 19, Vite, Tailwind CSS 4, TanStack Query, lightweight-charts |
| Деплой | Docker (один контейнер: API + статика), Amvera |

## Локальный запуск

```bash
npm install
npm run db:up                         # Postgres в Docker на порту 5440
cp backend/.env.example backend/.env  # заполнить APP_PASSWORD, JWT_SECRET, AI_API_KEY
npm run dev                           # API :3001 + фронтенд :5173
```

Открыть http://localhost:5173 и войти с паролем `APP_PASSWORD`. Миграции БД применяются автоматически при старте.

Прочие команды: `npm test` (тесты индикаторов), `npm run typecheck`, `npm run build`, `npm start`.

## Переменные окружения

| Переменная | Обязательна | Описание |
|---|---|---|
| `APP_PASSWORD` | да | Пароль входа, ≥ 8 символов |
| `JWT_SECRET` | да | Секрет сессий, ≥ 32 символов (`openssl rand -hex 32`) |
| `DATABASE_URL` | да в проде | Строка подключения к Postgres |
| `DATABASE_SSL` | | `true` для облачной БД с TLS |
| `AI_API_KEY` | для AI | Ключ API. Без него работает всё, кроме анализа |
| `AI_BASE_URL` | | По умолчанию `https://api.deepseek.com` |
| `AI_MODEL` | | По умолчанию `deepseek-chat` |

Другой провайдер — поменять `AI_BASE_URL` и `AI_MODEL`, например OpenRouter (`https://openrouter.ai/api/v1`) даёт доступ к Claude, GPT и др.

## Деплой на Amvera

1. В проекте Amvera → «Переменные» добавить **секреты**: `DATABASE_URL`, `APP_PASSWORD`, `JWT_SECRET`, `AI_API_KEY`.
2. Запушить репозиторий — Amvera соберёт `Dockerfile` по `amvera.yaml`.

## Структура

```
backend/
  src/
    index.ts          запуск + миграции
    app.ts            Express, роуты, раздача фронтенда
    auth.ts           вход по паролю, cookie-сессия
    moex.ts           клиент MOEX ISS с кэшем
    indicators.ts     технические индикаторы
    ai.ts             промпт, вызов LLM, валидация ответа
    routes/           market, watchlist, analysis
  migrations/         SQL-миграции
  test/
frontend/src/
  pages/              Dashboard, Instrument, History, Login
  components/         график, индикаторы, карточка анализа, поиск
```

Старый прототип (HFT / multi-tenant) сохранён в ветке `legacy`.
