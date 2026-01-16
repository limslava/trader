# Multi-stage Dockerfile для Russian Trader App
# Этап 1: Сборка frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Копируем package.json и package-lock.json
COPY frontend/package*.json ./

# Устанавливаем зависимости frontend
RUN npm ci --only=production

# Копируем исходный код frontend
COPY frontend/ .

# Собираем frontend
RUN npm run build

# Этап 2: Сборка backend
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend

# Копируем package.json и package-lock.json
COPY backend/package*.json ./

# Устанавливаем зависимости backend
RUN npm ci --only=production

# Копируем исходный код backend
COPY backend/ .

# Компилируем TypeScript
RUN npm run build

# Этап 3: Production образ
FROM node:18-alpine

WORKDIR /app

# Устанавливаем зависимости только для production
COPY --from=backend-builder /app/backend/package*.json ./backend/
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/dist ./backend/dist

# Копируем собранный frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Копируем необходимые файлы
COPY backend/.env.example ./backend/.env
COPY postgres-init.sql ./postgres-init.sql

# Создаем симлинк для статики frontend внутри backend
RUN ln -sf /app/frontend/dist /app/backend/frontend-dist

# Устанавливаем переменные окружения
ENV NODE_ENV=production
ENV PORT=80

# Открываем порт (можно изменить через переменную окружения PORT)
EXPOSE 80

# Устанавливаем healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-80}/health || exit 1

# Запускаем приложение
CMD ["node", "backend/dist/server.js"]