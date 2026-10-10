FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY backend backend
COPY frontend frontend
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=80
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev -w backend && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
COPY backend/migrations backend/migrations
# T-Bank's API uses the Russian Ministry of Digital Development CA, absent from Node's bundle.
COPY backend/certs backend/certs
ENV NODE_EXTRA_CA_CERTS=/app/backend/certs/russian-trusted-ca.pem
COPY --from=build /app/frontend/dist frontend/dist
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://localhost:80/health || exit 1
CMD ["node", "backend/dist/index.js"]
