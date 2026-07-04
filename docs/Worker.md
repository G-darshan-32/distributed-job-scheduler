# Worker Service

## Overview

The worker is a standalone Node.js process that polls PostgreSQL for pending jobs, executes them concurrently up to a configurable limit, and handles the full retry/DLQ lifecycle.

## Startup Sequence

```
1. Connect to PostgreSQL
2. Register worker row (id, hostname, pid, status=IDLE)
3. Start heartbeat timer (every 15s)
4. Start poll timer (every 1s)
5. Listen for SIGTERM/SIGINT for graceful shutdown
```

## Atomic Job Claiming

The worker uses PostgreSQL's `SELECT FOR UPDATE SKIP LOCKED` to prevent duplicate execution:

```sql
SELECT j.id
FROM jobs j
JOIN queues q ON q.id = j.queue_id
WHERE j.status = 'PENDING'
  AND q.is_paused = false
  AND q.is_active = true
  AND (j.run_at IS NULL OR j.run_at <= NOW())
  AND (
    SELECT COUNT(*) FROM jobs running
    WHERE running.queue_id = j.queue_id AND running.status = 'RUNNING'
  ) < q.concurrency_limit
ORDER BY j.priority DESC, j.created_at ASC
LIMIT 1
FOR UPDATE OF j SKIP LOCKED
```

`SKIP LOCKED` means competing workers skip rows that are already locked by another transaction, eliminating contention entirely. No Redis or external coordination needed.

## Concurrency Model

```
┌─────────────────────────────────────────┐
│ Worker (concurrency=5)                  │
│                                         │
│  Poll Loop (1s)                         │
│  while activeJobs.size < concurrency:   │
│    claim = claimNextJob()               │
│    if claim: activeJobs.add(process())  │
│                                         │
│  Active Job Map:                        │
│  { jobId → Promise<void> }              │
└─────────────────────────────────────────┘
```

## Retry Flow

```
Job fails (attempt N)
  │
  ├─ attempt < maxAttempts?
  │     YES → calculate delay (Fixed/Linear/Exponential)
  │           update job: status=SCHEDULED, runAt=now+delay
  │           scheduler will promote back to PENDING when due
  │
  └─ attempt >= maxAttempts
        → update job: status=DEAD
        → create DLQ entry
        → update batch counters (if batch job)
```

## Heartbeat

Every 15 seconds the worker writes:
1. `workers.last_seen_at = NOW()`
2. `workers.active_jobs = current count`
3. New `worker_heartbeats` row (time-series for charting)

The API marks workers `OFFLINE` if `last_seen_at < NOW() - 60s`.

## Graceful Shutdown

```
SIGTERM/SIGINT received
  │
  ├─ Set isDraining = true (stop accepting new jobs)
  ├─ Clear poll timer
  ├─ await Promise.allSettled(activeJobs) — up to 30s
  ├─ Update worker status to OFFLINE
  ├─ Disconnect Prisma
  └─ process.exit(0)
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_CONCURRENCY` | 5 | Max parallel jobs per worker |
| `WORKER_POLL_INTERVAL_MS` | 1000 | Polling frequency |
| `HEARTBEAT_INTERVAL_MS` | 15000 | Heartbeat frequency |
| `WORKER_STALE_THRESHOLD_MS` | 60000 | Threshold to mark worker offline |

## Scaling

- Run multiple worker containers: `docker compose up --scale worker=4`
- Each worker independently claims jobs — no shared state needed
- Queue `concurrency_limit` is enforced globally across all workers via the SQL subquery
