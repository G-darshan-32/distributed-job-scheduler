# Design Decisions & Tradeoffs

## Why PostgreSQL?

**Decision:** Use PostgreSQL as both the job store and the coordination layer.

**Reasoning:**
- `SELECT FOR UPDATE SKIP LOCKED` provides atomic, contention-free job claiming with zero extra infrastructure.
- Strong transactional guarantees mean a worker can claim a job, record execution metadata, and update status atomically — eliminating a whole class of race conditions.
- Mature ecosystem, excellent Prisma support, JSON column support for flexible payloads.

**Alternative considered:** MongoDB — rejected because it lacks row-level locking semantics needed for atomic claiming without external coordination.

**Tradeoff:** PostgreSQL is the single point of coordination. Under extreme write load (>10k jobs/sec), you'd shard by queue or move the queue storage to a purpose-built system.

---

## Why Prisma?

**Decision:** Prisma ORM over raw SQL or Knex.

**Reasoning:**
- Type-safe queries eliminate an entire class of runtime errors.
- Schema-as-code with migrations makes database evolution safe and auditable.
- `prisma.$transaction` and `prisma.$queryRaw` give escape hatches for complex queries like `SKIP LOCKED`.

**Tradeoff:** Prisma adds a compile step and can generate suboptimal queries for complex aggregations — mitigated by using `$queryRaw` for the hot claim path.

---

## Why Custom Worker Instead of BullMQ?

**Decision:** Build a custom polling worker rather than use BullMQ or similar.

**Reasoning (assignment requirement aside):**
- Full visibility into every design decision (no magic).
- No Redis dependency for the core queue — PostgreSQL is sufficient for the scale target.
- `SKIP LOCKED` handles concurrent workers natively without Lua scripts.
- Simpler operational model — no separate Redis queue to monitor.

**Tradeoff:** BullMQ would give rate limiting, backpressure, and Redis Streams integration out of the box. Our custom implementation covers the same feature surface but requires more code.

---

## Why WebSockets Instead of SSE?

**Decision:** WebSocket (`ws` library) for real-time updates.

**Reasoning:**
- Bidirectional — clients can subscribe to specific channels (`queue:uuid`) rather than receiving all events.
- Better browser support and simpler proxy configuration than SSE.
- Enables future client → server messages (e.g., remote cancel).

**Tradeoff:** WebSockets require sticky sessions in a horizontally scaled deployment. Mitigation: use Redis pub/sub to fan out broadcast messages across multiple backend instances.

---

## Atomic Job Claiming

**Decision:** `SELECT FOR UPDATE SKIP LOCKED` in a PostgreSQL transaction.

**How it works:**
1. Worker begins a transaction.
2. `SELECT ... FOR UPDATE SKIP LOCKED` locks exactly one PENDING row, skipping any rows locked by another worker.
3. Within the same transaction, update status to CLAIMED.
4. Commit — lock released, row owned by this worker.

**Why not optimistic locking?** Optimistic locking would cause retry loops under high concurrency. `SKIP LOCKED` scales linearly — each worker gets a different row with no retries.

---

## Distributed Locking (Scheduler)

**Decision:** Database-backed advisory locks using `distributed_locks` table.

**How it works:**
- On each 30-second tick, the scheduler does an upsert on `distributed_locks` with `ON CONFLICT DO UPDATE WHERE expires_at < NOW()`.
- If the row already exists and hasn't expired, the upsert is a no-op, and we verify the holder matches.
- Only one scheduler instance runs the tick — others silently skip.

**Alternative:** Redis Redlock algorithm — better for multi-region deployments but adds operational complexity. Our database lock is sufficient for single-region deployments.

**Tradeoff:** If the scheduler process crashes mid-tick, the lock expires naturally after 55 seconds and another instance takes over.

---

## Retry Strategy with Jitter

**Decision:** Exponential backoff adds ±10% jitter to delays.

**Why:** Without jitter, all workers retry failed jobs at exactly the same moment after a shared downstream failure (thundering herd). Jitter spreads retries across the delay window.

**Formula:** `delay = base * multiplier^(attempt-1) * (1 ± 0.1 * rand)`

---

## Concurrency Control

**Decision:** Queue-level `concurrency_limit` enforced via SQL subquery in the claim query.

```sql
AND (
  SELECT COUNT(*) FROM jobs running
  WHERE running.queue_id = j.queue_id AND running.status = 'RUNNING'
) < q.concurrency_limit
```

**Tradeoff:** This subquery runs on every poll. With the `(queue_id, status)` index, it's a fast index scan. At extreme scale (millions of concurrent jobs), this could be replaced with a Redis counter per queue.

---

## Transaction Strategy

| Operation | Strategy | Why |
|-----------|----------|-----|
| Job claiming | Pessimistic (`FOR UPDATE`) | Must prevent duplicates |
| Worker registration | Optimistic (simple INSERT) | No contention |
| Batch job creation | `$transaction([])` | Atomic multi-row insert |
| DLQ transition | `$transaction([])` | Job + DLQ entry must be atomic |
| Scheduler promotion | `updateMany` | Bulk update, no per-row lock needed |

---

## Index Strategy

| Index | Purpose |
|-------|---------|
| `(queue_id, status, priority, created_at)` | Covers the entire claim query predicate |
| `status` on jobs | Scheduler promotion scans |
| `run_at` on jobs | Delayed job filter |
| `(job_id, timestamp)` on job_logs | Paginated log queries |
| `(worker_id, timestamp)` on heartbeats | Heartbeat chart queries |
| `expires_at` on distributed_locks | Lock expiry cleanup |

---

## Why Not Event-Driven (Kafka/Rabbit)?

**Decision:** Polling instead of message broker.

**Reasoning for this project:**
- Simpler deployment (no Kafka/RabbitMQ cluster).
- PostgreSQL NOTIFY could replace polling entirely (see FutureImprovements.md).
- For the target scale (<10k jobs/min per queue), 1-second polling latency is acceptable.

**When to switch:** If you need sub-100ms job pickup latency at scale, move to PostgreSQL `LISTEN/NOTIFY` or a message broker.
