#!/usr/bin/env bash
# setup.sh — One-command local development setup
set -e

echo "==> Distributed Job Scheduler — Setup"

# Check dependencies
command -v docker >/dev/null 2>&1 || { echo "Docker is required. https://docs.docker.com/get-docker/"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js 20+ is required. https://nodejs.org/"; exit 1; }

# Copy env if missing
if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> Created .env from .env.example — edit secrets before production use"
fi

# Start infra services
echo "==> Starting PostgreSQL and Redis..."
docker compose up postgres redis -d
sleep 3

# Backend setup
echo "==> Installing backend dependencies..."
cd backend
npm install --silent
npx prisma generate
npx prisma migrate dev --name init 2>/dev/null || npx prisma migrate deploy
npm run prisma:seed
cd ..

# Worker setup
echo "==> Installing worker dependencies..."
cd worker
npm install --silent
npx prisma generate
cd ..

# Frontend setup
echo "==> Installing frontend dependencies..."
cd frontend
npm install --silent
cd ..

echo ""
echo "==> Setup complete!"
echo ""
echo "Start services:"
echo "  Backend:  cd backend && npm run dev"
echo "  Worker:   cd worker  && npm run dev"
echo "  Frontend: cd frontend && npm run dev"
echo ""
echo "Or start everything with Docker:"
echo "  docker compose up --build"
echo ""
echo "Dashboard:  http://localhost:3000"
echo "API:        http://localhost:4000/api/v1"
echo "API Docs:   http://localhost:4000/api-docs"
echo "Login:      admin@example.com / Admin@123"
