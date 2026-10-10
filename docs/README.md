# Russian Trader V2 Docs

This repository contains the backend V2 for a multi-tenant HFT trading platform.

## Quick Start
- Run backend: `cd backend && npm run dev`
- API root: `/api`

## Key Endpoints (V2)
- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/profile`
- Tenants: `GET /api/tenants`, `POST /api/tenants`, `GET /api/tenants/members`
- Orders: `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`
- Brokers: `GET /api/brokers`, `POST /api/brokers`
- Crypto: `POST /api/crypto/orders`
- Metrics: `GET /api/metrics`

## Migrations
Apply SQL patches from `backend/sql/` as needed.
