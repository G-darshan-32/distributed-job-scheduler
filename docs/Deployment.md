# Deployment

## Docker Compose (Recommended)

### Prerequisites
- Docker 24+
- Docker Compose v2

### Production Deployment

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env — set strong JWT secrets and DB passwords

# 2. Build and start all services
docker compose up -d --build

# 3. Run migrations (first run only)
docker compose exec backend npx prisma migrate deploy

# 4. Seed default data (first run only)
docker compose exec backend npm run prisma:seed

# 5. Verify all services are healthy
docker compose ps
docker compose logs backend --tail=20
```

### Scale Workers

```bash
# Run 4 worker instances
docker compose up -d --scale worker=4
```

### Update Application

```bash
docker compose build backend frontend worker
docker compose up -d
docker compose exec backend npx prisma migrate deploy
```

## Service URLs

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3000 |
| API | http://localhost:4000/api/v1 |
| API Docs | http://localhost:4000/api-docs |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Min 32 chars. Never commit. |
| `JWT_REFRESH_SECRET` | Yes | Min 32 chars. Never commit. |
| `POSTGRES_USER` | Yes | DB username |
| `POSTGRES_PASSWORD` | Yes | DB password |
| `WORKER_CONCURRENCY` | No | Default 5 |
| `OPENAI_API_KEY` | No | For AI failure summaries |

## Production Checklist

- [ ] Generate strong `JWT_SECRET` and `JWT_REFRESH_SECRET` (`openssl rand -base64 48`)
- [ ] Set `NODE_ENV=production`
- [ ] Configure TLS termination (nginx/Caddy reverse proxy)
- [ ] Set `CORS_ORIGIN` to your actual frontend domain
- [ ] Configure log aggregation (ship `logs/` to ELK/Datadog)
- [ ] Set up PostgreSQL backups (pg_dump cron or managed DB)
- [ ] Monitor worker heartbeats via the dashboard
- [ ] Set `RATE_LIMIT_MAX` appropriate to your load

## Logs

```bash
# Backend logs
docker compose logs backend -f

# Worker logs
docker compose logs worker -f

# Log files are mounted at:
# backend/logs/app-YYYY-MM-DD.log
# worker/logs/worker-YYYY-MM-DD.log
```

## Health Monitoring

```bash
# Check system health
curl http://localhost:4000/api/v1/health

# Expected healthy response:
# { "status": "ok", "services": { "database": "ok", "redis": "ok" } }
```

## Database Migrations

```bash
# Generate a new migration (development)
docker compose exec backend npx prisma migrate dev --name describe_change

# Apply migrations (production)
docker compose exec backend npx prisma migrate deploy

# Open Prisma Studio (development)
docker compose exec backend npx prisma studio
```
