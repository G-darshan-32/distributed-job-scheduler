# Testing

## Strategy

Tests are integration tests that run against a real PostgreSQL database (test instance).
We use Jest + Supertest for API tests and direct Prisma calls for service-layer tests.

**Coverage targets:**
- Auth flows: register, login, refresh, logout, protected routes
- Queue API: create, list, pause/resume, stats
- Job API: all types, idempotency, cancel, retry, batch, filtering
- Worker logic: atomic claiming, priority ordering, concurrency, DLQ transitions
- Retry calculator: all three strategies, jitter, capping
- Scheduler: delayed job promotion, cron job triggering

## Prerequisites

```bash
# A running PostgreSQL instance for tests
# Recommended: use the docker-compose postgres service
docker compose up postgres -d

# Set test DATABASE_URL (can be same DB, tests clean up after themselves)
export DATABASE_URL="postgresql://djs_user:djs_password@localhost:5432/djs_db"
```

## Running Tests

```bash
cd backend

# Install deps
npm install

# Generate Prisma client
npx prisma generate

# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run a specific test file
npx jest tests/auth.test.ts

# Run in watch mode (development)
npx jest --watch
```

## Test Structure

```
backend/tests/
├── setup.ts           Global beforeAll/afterAll + afterEach cleanup
├── helpers.ts         Factory functions: createTestUser, createTestOrg, etc.
├── auth.test.ts       Authentication API (register, login, refresh, logout, me)
├── queue.test.ts      Queue CRUD, pause/resume, stats
├── job.test.ts        Job dispatch (all types), batch, cancel, retry, filters
├── worker.test.ts     Atomic claiming, priority, concurrency, DLQ transition
├── retry.test.ts      Unit tests for calculateRetryDelay (all strategies)
├── retryPolicy.test.ts Retry policy CRUD API
├── health.test.ts     Health check endpoint
└── scheduler.test.ts  Delayed job promotion, cron job triggering
```

## Test Isolation

`tests/setup.ts` runs `afterEach` that deletes all rows in correct FK order.
Tests are fully isolated — each `beforeEach` creates fresh fixtures.

## Coverage Report

```bash
npm run test:coverage
# Opens coverage/lcov-report/index.html
```

Expected output:
```
File                          | % Stmts | % Branch | % Funcs | % Lines
------------------------------|---------|----------|---------|--------
services/auth.service.ts      |   92.5  |   88.0   |   100   |  92.5
services/job.service.ts       |   88.3  |   82.0   |   100   |  88.3
services/queue.service.ts     |   90.0  |   85.0   |   100   |  90.0
services/scheduler.service.ts |   78.0  |   75.0   |   100   |  78.0
utils/retry.ts                |  100.0  |  100.0   |   100   | 100.0
utils/cron.ts                 |   82.0  |   80.0   |   100   |  82.0
```

## CI Integration

```yaml
# .github/workflows/test.yml (example)
- name: Run tests
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
    JWT_SECRET: test-secret-at-least-16-chars
    JWT_REFRESH_SECRET: test-refresh-secret-16c
    REDIS_URL: redis://localhost:6379
  run: |
    cd backend
    npm ci
    npx prisma generate
    npx prisma migrate deploy
    npm test
```
