#!/usr/bin/env bash
# test.sh — Run all tests
set -e

echo "==> Starting test database..."
docker compose up postgres -d
sleep 2

echo "==> Running backend tests..."
cd backend
export DATABASE_URL="${DATABASE_URL:-postgresql://djs_user:djs_password@localhost:5432/djs_db}"
export JWT_SECRET="${JWT_SECRET:-test-secret-minimum-sixteen-chars}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-test-refresh-secret-16c}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export NODE_ENV=test
export LOG_LEVEL=error

npx prisma generate --silent
npx prisma migrate deploy --skip-generate 2>/dev/null || true

npm test -- --forceExit

echo "==> All tests passed!"
