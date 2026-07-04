# Distributed Job Scheduler

A production-grade distributed job scheduling platform built with Node.js, PostgreSQL, React, and TypeScript.

## Quick Start

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with your secrets

# 2. Start all services
docker compose up -d

# 3. Run database migrations and seed
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run prisma:seed

# 4. Open the dashboard
open http://localhost:3000

# Credentials: admin@example.com / Admin@123
# API Docs:    http://localhost:4000/api-docs
```

## Local Development (without Docker)

```bash
# Start Postgres and Redis
docker compose up postgres redis -d

# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev        # http://localhost:4000

# Worker (new terminal)
cd worker
npm install
npx prisma generate
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev        # http://localhost:3000
```

## Project Structure

```
.
├── backend/           Express API server
│   ├── prisma/        Prisma schema + migrations + seed
│   ├── src/
│   │   ├── config/    Environment config with Zod validation
│   │   ├── controllers/
│   │   ├── lib/       Prisma, Redis, WebSocket clients
│   │   ├── middleware/ Auth, error, validation, rate-limiting, RBAC
│   │   ├── routes/
│   │   ├── services/  Business logic layer
│   │   └── utils/
│   └── tests/         Jest + Supertest integration tests
├── worker/            Standalone job processor
│   └── src/
│       ├── worker.ts  Main poll loop + graceful shutdown
│       ├── executor.ts Job execution engine
│       └── retry.ts   Retry delay calculator
├── frontend/          React + Vite + TailwindCSS dashboard
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── lib/       Axios API client, WebSocket client
│       ├── pages/
│       └── stores/    Zustand auth state
├── docs/              Full documentation
├── docker/            Docker helper files
├── docker-compose.yml
└── .env.example
```

## Features

- JWT authentication with refresh token rotation
- Organizations → Projects → Queues hierarchy
- Job types: Immediate, Delayed, Scheduled, Recurring (cron), Batch
- Atomic job claiming with `SELECT FOR UPDATE SKIP LOCKED`
- Retry engine: Fixed / Linear / Exponential backoff with jitter
- Dead Letter Queue with AI failure summaries
- WebSocket real-time updates
- Worker heartbeat monitoring
- Queue pause/resume, concurrency limits, rate limiting
- Workflow dependencies (parent/child jobs)
- Distributed locking for scheduler coordination
- RBAC: Owner / Admin / Member / Viewer roles
- Swagger API docs at `/api-docs`

## Documentation

| File | Description |
|------|-------------|
| [Architecture](Architecture.md) | System design and diagrams |
| [Database](Database.md) | Schema design and ER diagram |
| [API](API.md) | REST API reference |
| [Worker](Worker.md) | Worker service internals |
| [Frontend](Frontend.md) | Dashboard guide |
| [Deployment](Deployment.md) | Docker and production deployment |
| [Testing](Testing.md) | Test strategy and running tests |
| [Tradeoffs](Tradeoffs.md) | Design decisions and tradeoffs |
| [FutureImprovements](FutureImprovements.md) | Roadmap |
