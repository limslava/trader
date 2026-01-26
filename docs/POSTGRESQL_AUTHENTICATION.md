# PostgreSQL Аутентификация для Russian Trader

## 📋 Обзор

Мы успешно мигрировали с MongoDB на PostgreSQL для хранения данных пользователей. PostgreSQL обеспечивает надежное постоянное хранение данных с полной совместимостью с российскими требованиями.

## 🏗️ Архитектура

### Компоненты системы:

1. **PostgreSQL Database** - основное хранилище данных
2. **PostgresAuthService** - сервис аутентификации для PostgreSQL
3. **postgresAuthRoutes** - API маршруты для PostgreSQL аутентификации
4. **Docker Compose (опционально)** - контейнеризация базы данных

### Стек технологий:
- **PostgreSQL 15** - реляционная база данных
- **pg (node-postgres)** - драйвер PostgreSQL для Node.js
- **bcryptjs** - хеширование паролей
- **jsonwebtoken** - JWT токены для аутентификации

## 🚀 Быстрый старт

### 1. Запуск PostgreSQL

```bash
# Вариант A: через Docker Compose
docker-compose up -d
docker ps
```

```bash
# Вариант B: локально без Docker (PostgreSQL уже установлен)
# Убедитесь, что сервис запущен и слушает нужный порт (например, 5433)
```

### 1.1 Инициализация таблиц

Используйте `postgres-init.sql` из корня проекта, чтобы создать таблицы.

### 2. Проверка подключения

```bash
# Проверка подключения к базе данных
docker exec russian-trader-postgres psql -U trader -d russian-trader -c "SELECT version();"
```

### 3. Тестирование аутентификации

#### Вход пользователя:
```bash
curl -X POST http://localhost:3001/api/postgres-auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "2720233@gmail.com", "password": "test123"}'
```

#### Получение информации о пользователе:
```bash
curl -X GET http://localhost:3001/api/postgres-auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📊 Структура базы данных

### Таблица `users`:

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    profile JSONB,
    preferences JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Поля профиля пользователя:

```json
{
  "profile": {
    "firstName": "Тестовый",
    "lastName": "Пользователь", 
    "experienceLevel": "BEGINNER",
    "riskTolerance": "MEDIUM",
    "investmentGoals": ["Обучение", "Рост капитала"]
  },
  "preferences": {
    "notifications": {
      "email": true,
      "push": true,
      "priceAlerts": true,
      "riskAlerts": true
    },
    "theme": "LIGHT",
    "language": "RU",
    "currency": "RUB",
    "defaultExchange": "MOEX"
  }
}
```

## 🔐 API Endpoints

### PostgreSQL Аутентификация

#### POST `/api/postgres-auth/register`
**Регистрация нового пользователя**

```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "password123",
  "profile": {
    "firstName": "Имя",
    "lastName": "Фамилия"
  }
}
```

#### POST `/api/postgres-auth/login` 
**Вход пользователя**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### GET `/api/postgres-auth/me`
**Получение информации о текущем пользователе**

```bash
Authorization: Bearer <JWT_TOKEN>
```

#### POST `/api/postgres-auth/verify`
**Проверка токена**

```json
{
  "token": "jwt_token_here"
}
```

## 🔧 Конфигурация

### Переменные окружения (.env):

```env
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DB=russian-trader
POSTGRES_USER=trader
POSTGRES_PASSWORD=trader123

# JWT
JWT_SECRET=russian-trader-secret-key-2025
```

### Docker Compose (docker-compose.yml, опционально):

```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: russian-trader
      POSTGRES_USER: trader
      POSTGRES_PASSWORD: trader123
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres-init.sql:/docker-entrypoint-initdb.d/init.sql
```

## 🛡️ Безопасность

### Хеширование паролей:
- Используется bcryptjs с 12 раундами соли
- Пароли никогда не хранятся в открытом виде

### JWT Токены:
- Срок действия: 24 часа
- Секретный ключ хранится в переменных окружения
- Refresh токены для продления сессии

### Защита данных:
- Все соединения с PostgreSQL шифруются
- Валидация входных данных на всех уровнях
- Защита от SQL-инъекций через параметризованные запросы

## 📈 Мониторинг

### Проверка состояния базы данных:

```bash
# Количество пользователей
docker exec russian-trader-postgres psql -U trader -d russian-trader -c "SELECT COUNT(*) FROM users;"

# Размер базы данных
docker exec russian-trader-postgres psql -U trader -d russian-trader -c "SELECT pg_size_pretty(pg_database_size('russian-trader'));"

# Активные подключения
docker exec russian-trader-postgres psql -U trader -d russian-trader -c "SELECT COUNT(*) FROM pg_stat_activity;"
```

## 🔄 Миграция данных

### Из MongoDB в PostgreSQL:

1. **Экспорт данных из MongoDB:**
```bash
mongoexport --db russian-trader --collection users --out users.json
```

2. **Преобразование данных:**
```javascript
// Скрипт для преобразования JSON в SQL
```

3. **Импорт в PostgreSQL:**
```bash
psql -U trader -d russian-trader -f import_users.sql
```

## 🚨 Устранение неисправностей

### Распространенные проблемы:

1. **Ошибка подключения к PostgreSQL:**
   - Проверьте запущен ли контейнер: `docker ps`
   - Проверьте порт: `5433` вместо `5432`
   - Проверьте логи: `docker logs russian-trader-postgres`

2. **Ошибка аутентификации:**
   - Проверьте правильность email и пароля
   - Проверьте хеш пароля в базе данных
   - Проверьте JWT секрет

3. **Ошибки производительности:**
   - Проверьте индексы в базе данных
   - Мониторинг использования памяти
   - Оптимизация запросов

## 📞 Поддержка

Для получения помощи по PostgreSQL аутентификации:

1. Проверьте логи сервера: `cd backend && npm run dev`
2. Проверьте логи PostgreSQL: `docker logs russian-trader-postgres`
3. Обратитесь к документации: `docs/`
4. Создайте issue в репозитории проекта

---

**Статус:** ✅ **Production Ready**  
**Версия:** 1.0.0  
**Последнее обновление:** 2025-11-04
