# Развёртывание на Legion — trader.vlbrain.ru

## Схема

```
интернет ─► роутер (проброс 80/443) ─► Legion
   └─ Caddy проекта second-brain (/srv/second-brain, Let's Encrypt)
        ├─ vlbrain.ru        → second-brain
        ├─ pass.vlbrain.ru   → менеджер паролей
        └─ trader.vlbrain.ru → trader-web:80   ← ТОЛЬКО с клиентским сертификатом
              └─ ~/trader: app (API + собранный фронт) → db (Postgres 17)
                                                      └→ Ollama хоста :11434 (GPU) — локальные модели арены
```

- Проект: `~/trader` (пользователь `vladislav`), стек `docker-compose.legion.yml`.
  Наружу портов не публикует; контейнер `app` подключён к сети `second-brain_default`
  под именем `trader-web`.
- Секреты — `~/trader/.env` (права 600): пароль приложения, JWT_SECRET, ключ AI,
  токен T-Invest (песочница), POSTGRES_PASSWORD.
- Бэкапы — `~/trader/backups/trader-*.dump` раз в сутки, хранится 14 последних.
  Восстановить: `docker compose -f docker-compose.legion.yml exec -T db pg_restore -U trader -d trader --clean --if-exists < backups/<файл>`.

## Слои защиты

1. **Клиентский сертификат (mTLS)** на уровне Caddy — тот же CA, что у менеджера
   паролей (`~/.password-mtls/` на Mac). Устройство без сертификата не получит даже
   страницу входа. Установка сертификата на Mac/iPhone описана в `password/docs/LEGION.md`.
2. **Пароль приложения** (`APP_PASSWORD`), лимит попыток по IP и блокировка на 15 минут
   после 5 неудач.
3. **Код из приложения-аутентификатора (TOTP)** — включается на странице «Безопасность»;
   принятый код нельзя использовать повторно.
4. **Passkey (Face ID / Touch ID)** — регистрируется на странице «Безопасность» с каждого
   устройства; вход по passkey заменяет пароль и код. Домен passkey — `trader.vlbrain.ru`.

## Обновление кода

```bash
scripts/deploy-legion.sh
```

Синхронизирует рабочую копию (без `.env`, `node_modules`, `backups`) и пересобирает
контейнер. Миграции применяются при старте приложения.

## Арена на сервере

Раунды идут по будням в 11:00 МСК, пока работает контейнер `app`. Локальные модели —
общая Ollama Legion (контейнер `ollama`, RTX 3060 6 ГБ): `docker exec ollama ollama pull qwen3:14b`.
Модели крупнее ~8B частично считаются на CPU, ход занимает несколько минут.

## Телефон

Открыть https://trader.vlbrain.ru в Safari (сертификат уже установлен для pass.vlbrain.ru) →
«Поделиться» → «На экран Домой». Приложение откроется в полноэкранном режиме.
