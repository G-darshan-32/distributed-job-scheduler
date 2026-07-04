# Database Design

## Overview

PostgreSQL 16 with Prisma ORM. Normalized to 3NF with strategic denormalization for performance.

## ER Diagram (Simplified)

```
users ──────────── org_memberships ──────────── organizations
  │                    (role)                        │
  │                                                  │
refresh_tokens                                    projects
                                                     │
retry_policies ────────────────────────────────── queues
                                                     │
                                                  ┌──┴───────────┐
                                                  │              │
                                                 jobs         queue_shards
                                                  │
                         ┌────────────────────────┼──────────────────────┐
                         │                        │                      │
                    job_batches           job_executions              job_logs
                                                  │
                                               workers
                                                  │
                                          worker_heartbeats
                                                  │
                                             dlq_entries
                                                  │
                                          scheduled_jobs
                                                  │
                                       distributed_locks
```

## Table Reference

### users
- **Purpose**: User accounts. Passwords bcrypt-hashed at cost 12.
- **PK**: `id UUID`
- **Unique**: `email`
- **Indexes**: `email`
- **Cascade**: Membership rows cascade on delete.

### organizations
- **Purpose**: Top-level multi-tenant namespace.
- **PK**: `id UUID`
- **Unique**: `slug`
- **Cascade**: Projects, memberships cascade on delete.

### org_memberships
- **Purpose**: RBAC join table — user:org with role (OWNER/ADMIN/MEMBER/VIEWER).
- **PK**: `id UUID`
- **Unique**: `(user_id, organization_id)`
- **FK**: `user_id → users.id CASCADE`, `organization_id → organizations.id CASCADE`

### projects
- **Purpose**: Logical grouping of queues within an org.
- **PK**: `id UUID`
- **Unique**: `(organization_id, slug)`
- **FK**: `organization_id → organizations.id CASCADE`

### retry_policies
- **Purpose**: Reusable retry configurations. Queues reference these by FK.
- **PK**: `id UUID`
- **Design note**: Decoupled from queues so one policy can be shared across many queues.

### queues
- **Purpose**: Named FIFO/priority queues. Owns all jobs.
- **PK**: `id UUID`
- **Unique**: `(project_id, slug)`
- **FK**: `project_id CASCADE`, `retry_policy_id SET NULL`
- **Indexes**: `(is_paused, is_active)`, `priority` — used by the worker claim query.
- **Key columns**:
  - `concurrency_limit INT` — max parallel jobs, enforced at claim time via subquery
  - `rate_limit_per_min INT NULL` — optional token bucket rate limiting
  - `job_timeout_ms INT` — default timeout for jobs in this queue

### jobs
- **Purpose**: Core work unit. Immutable payload, mutable status.
- **PK**: `id UUID`
- **Unique**: `idempotency_key` (nullable) — client-supplied deduplication key
- **FK**: `queue_id CASCADE`, `batch_id SET NULL`, `parent_job_id SET NULL`
- **Indexes**:
  - `(queue_id, status, priority, created_at)` — composite for the claim query
  - `status` — for scheduler promotion queries
  - `run_at` — for delayed job promotion
  - `claimed_by` — to find jobs held by a specific worker
- **Concurrency control**: `SELECT FOR UPDATE SKIP LOCKED` on status=PENDING

### job_executions
- **Purpose**: Immutable audit log of every execution attempt. Never updated.
- **PK**: `id UUID`
- **FK**: `job_id CASCADE`, `worker_id CASCADE`
- **Indexes**: `(job_id)`, `(worker_id)`, `(started_at)`
- **Design note**: Separate from jobs table to keep the hot jobs table narrow.

### job_logs
- **Purpose**: Per-job structured log lines. Append-only.
- **PK**: `id UUID`
- **FK**: `job_id CASCADE`
- **Index**: `(job_id, timestamp)` — for paginated log queries

### scheduled_jobs
- **Purpose**: Tracks next-run metadata for recurring cron jobs.
- **Index**: `(next_run_at, is_active)` — scheduler polls this every 30s.

### workers
- **Purpose**: Registry of active worker processes. Auto-expired after 60s silence.
- **PK**: `id UUID` (set by worker at startup, not DB-generated)
- **Indexes**: `status`, `last_seen_at`

### worker_heartbeats
- **Purpose**: Time-series liveness data. Retained for 30 days.
- **FK**: `worker_id CASCADE`
- **Index**: `(worker_id, timestamp)`

### dlq_entries
- **Purpose**: Vault for permanently failed jobs.
- **PK**: `id UUID`
- **Unique**: `job_id` — one DLQ entry per job
- **FK**: `job_id CASCADE`
- **Indexes**: `queue_id`, `failed_at`

### distributed_locks
- **Purpose**: Advisory lock table used by scheduler to prevent dual execution.
- **PK**: `key VARCHAR` — the lock name
- **Index**: `expires_at` — for lock expiry cleanup

## Performance Considerations

1. **SKIP LOCKED** on job claims avoids contention between workers.
2. Composite index `(queue_id, status, priority, created_at)` covers the entire claim predicate.
3. `job_logs` and `worker_heartbeats` are append-only hot tables — consider pg_partman for time partitioning in production beyond 10M rows.
4. `pg_trgm` extension enables efficient `ILIKE` search on job names.
5. All foreign keys are indexed to avoid sequential scans on cascade operations.
