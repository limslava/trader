# Multi-stage Dockerfile для Russian Trader App
# Этап 1: Сборка frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

# Копируем package.json и package-lock.json
COPY frontend/package*.json ./

# Устанавливаем зависимости frontend, включая dev tooling для Vite build
RUN npm ci

# Копируем исходный код frontend
COPY frontend/ .

# Собираем frontend
RUN npm run build

# Этап 2: Сборка backend
FROM node:22-alpine AS backend-builder

WORKDIR /app/backend

# Копируем package.json и package-lock.json
COPY backend/package*.json ./

# Устанавливаем зависимости backend, включая TypeScript compiler
RUN npm ci

# Копируем исходный код backend
COPY backend/ .

# Компилируем TypeScript
RUN npm run build

# Этап 3: Production образ
FROM node:22-alpine

WORKDIR /app

# Устанавливаем только production зависимости backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY --from=backend-builder /app/backend/dist ./backend/dist

# Копируем собранный frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Копируем необходимые файлы
COPY postgres-init.sql ./postgres-init.sql

# Создаем симлинк для статики frontend внутри backend
RUN ln -sf /app/frontend/dist /app/backend/frontend-dist

# Устанавливаем переменные окружения
ENV NODE_ENV=production
ENV PORT=80
ENV TRADING_MODE=paper
ENV ENABLE_LIVE_TRADING=false

# Открываем порт (можно изменить через переменную окружения PORT)
EXPOSE 80

# Устанавливаем healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-80}/health || exit 1

# Запускаем приложение
CMD ["node", "backend/dist/server.js"]
