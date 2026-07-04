# Future Improvements

## High Priority

### PostgreSQL LISTEN/NOTIFY
Replace the 1-second poll loop with `pg_notify` triggered by a job INSERT trigger.
Workers subscribe with `LISTEN job_available` and wake instantly — reduces both latency and DB load.

```sql
CREATE OR REPLACE FUNCTION notify_job_available()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('job_available', NEW.queue_id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_inserted
AFTER INSERT ON jobs
FOR EACH ROW WHEN (NEW.status = 'PENDING')
EXECUTE FUNCTION notify_job_available();
```

### Redis Pub/Sub for Multi-Instance Backend
Current WebSocket broadcast only works with a single backend instance.
Replace `broadcast()` with Redis pub/sub so any backend instance can fan out to all WS clients.

```typescript
// Publisher (any backend instance)
redis.publish('ws:broadcast', JSON.stringify({ channel, data }));

// Subscriber (each backend instance)
redisSub.subscribe('ws:broadcast', (message) => {
  const { channel, data } = JSON.parse(message);
  broadcastToLocalClients(channel, data);
});
```

### Rate Limiting per Queue
Token bucket algorithm using Redis counters. Each job dispatch decrements the bucket; a Redis TTL refills it per minute. Already has `rate_limit_per_min` column in schema — just needs the enforcement layer.

---

## Medium Priority

### Workflow Engine (DAG Jobs)
Currently supports simple parent → child dependency (one level).
Extend to a full DAG: a job can declare multiple dependencies and only becomes PENDING when all parents COMPLETE.

```typescript
// Job dispatch with multiple dependencies
{
  "name": "final-report",
  "waitForJobIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

### Queue Sharding
The `queue_shards` table is already in the schema.
Implement consistent hashing to distribute a single high-volume queue across N shards, each with its own claim partition.

### Job Priority Queues (Heap-based)
Current implementation uses `ORDER BY priority DESC` which is O(log n) via the index.
For extreme priority volumes, maintain a separate sorted set in Redis mirroring the DB.

### Job Versioning & Payload Schema Validation
Allow queues to define a JSON Schema for their job payloads, validated at dispatch time.
Job schema versions ensure payload compatibility across deployments.

### Multi-Region Active-Active
- Move distributed locks to Redis Redlock (tolerates Redis node failures)
- Use logical replication for cross-region DB reads
- Route job dispatch to nearest region, workers can claim from any region

---

## Low Priority / Bonus Features

### Dead Letter Queue Auto-Retry Policy
Configure DLQ entries to automatically retry after N days, or when a human approves them in the dashboard.

### Webhook Callbacks
On job completion/failure, fire an HTTP POST to a configured callback URL.
Useful for serverless architectures where the client can't hold a WebSocket.

### Job Progress Reporting
Allow running jobs to POST progress updates (0–100%) which stream to the dashboard in real time.

### Admin Audit Log
Record every admin action (pause queue, replay DLQ, change retry policy) with userId, timestamp, and diff.

### OAuth2 / SSO
Add Google/GitHub OAuth2 login alongside the current email/password flow.

### Dashboard Improvements
- Dark/light mode toggle
- Customizable dashboard widgets
- Export job history as CSV
- Full-text search across job names and payloads using pg_trgm GIN indexes

### CLI Tool
```bash
djs jobs dispatch --queue email-queue --payload '{"to":"user@example.com"}'
djs queues list --project my-project
djs dlq replay --all --queue email-queue
```

### Kubernetes Deployment
- Helm chart for backend + worker
- HorizontalPodAutoscaler for workers based on queue depth metric exposed via `/metrics` (Prometheus format)
- PodDisruptionBudget for graceful rolling deploys
