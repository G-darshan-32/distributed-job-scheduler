# API Reference

Base URL: `http://localhost:4000/api/v1`  
Interactive docs: `http://localhost:4000/api-docs`

All authenticated endpoints require: `Authorization: Bearer <accessToken>`

All responses follow:
```json
{ "success": true, "data": {} }
{ "success": false, "error": { "code": "ERROR_CODE", "message": "..." } }
```

Paginated list responses include:
```json
{
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5, "hasNext": true, "hasPrev": false }
}
```

---

## Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register new user |
| POST | `/auth/login` | No | Login, returns token pair |
| POST | `/auth/refresh` | No | Rotate refresh token |
| POST | `/auth/logout` | No | Revoke refresh token |
| GET | `/auth/me` | Yes | Get current user profile |

### POST /auth/register
```json
{ "email": "user@example.com", "password": "Min8chars", "name": "Alice" }
```

### POST /auth/login
```json
{ "email": "user@example.com", "password": "..." }
// Response: { "accessToken": "...", "refreshToken": "..." }
```

---

## Organizations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/organizations` | Create organization |
| GET | `/organizations` | List user's orgs |
| GET | `/organizations/:orgId` | Get org with members |
| POST | `/organizations/:orgId/members` | Add member (ADMIN+) |
| DELETE | `/organizations/:orgId/members/:userId` | Remove member (ADMIN+) |

---

## Projects

| Method | Path | Description |
|--------|------|-------------|
| POST | `/organizations/:orgId/projects` | Create project |
| GET | `/organizations/:orgId/projects` | List projects (paginated) |
| GET | `/organizations/:orgId/projects/:projectId` | Get project |
| PATCH | `/organizations/:orgId/projects/:projectId` | Update project |
| DELETE | `/organizations/:orgId/projects/:projectId` | Soft-delete project |

---

## Queues

| Method | Path | Description |
|--------|------|-------------|
| POST | `/projects/:projectId/queues` | Create queue |
| GET | `/projects/:projectId/queues` | List queues (paginated) |
| GET | `/projects/:projectId/queues/:queueId` | Get queue |
| PATCH | `/projects/:projectId/queues/:queueId` | Update queue config |
| DELETE | `/projects/:projectId/queues/:queueId` | Soft-delete queue |
| POST | `/projects/:projectId/queues/:queueId/pause` | Pause queue |
| POST | `/projects/:projectId/queues/:queueId/resume` | Resume queue |
| GET | `/projects/:projectId/queues/:queueId/stats` | Queue statistics |

### Create Queue
```json
{
  "name": "email-queue",
  "description": "Transactional emails",
  "priority": 10,
  "concurrencyLimit": 20,
  "retryPolicyId": "uuid",
  "rateLimitPerMin": 100,
  "jobTimeout": 30000
}
```

---

## Jobs

| Method | Path | Description |
|--------|------|-------------|
| POST | `/queues/:queueId/jobs` | Dispatch a job |
| POST | `/queues/:queueId/jobs/batch` | Dispatch batch of jobs |
| GET | `/queues/:queueId/jobs` | List jobs (paginated, filterable) |
| GET | `/queues/:queueId/jobs/metrics` | Queue job metrics |
| GET | `/queues/:queueId/jobs/:jobId` | Get job detail |
| POST | `/queues/:queueId/jobs/:jobId/cancel` | Cancel pending/scheduled job |
| POST | `/queues/:queueId/jobs/:jobId/retry` | Re-queue failed/dead job |
| GET | `/queues/:queueId/jobs/:jobId/logs` | Get execution logs |

### Dispatch Job
```json
{
  "name": "send-invoice",
  "type": "IMMEDIATE",
  "payload": { "invoiceId": "inv_123" },
  "priority": 5,
  "maxAttempts": 3,
  "idempotencyKey": "invoice-123-send",
  "parentJobId": "uuid-of-parent-job"
}
```

### Delayed Job
```json
{ "name": "reminder", "runAt": "2026-07-04T10:00:00Z" }
```

### Recurring Job
```json
{ "name": "daily-report", "cronExpression": "0 9 * * 1-5" }
```

### Batch Job
```json
{
  "batchName": "Invoice Processing",
  "jobs": [
    { "name": "process-invoice-1", "payload": { "id": 1 } },
    { "name": "process-invoice-2", "payload": { "id": 2 } }
  ]
}
```

### Query Parameters (List Jobs)
| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number (default: 1) |
| `limit` | int | Items per page (default: 20, max: 100) |
| `status` | enum | Filter by job status |
| `type` | enum | Filter by job type |
| `search` | string | Search by job name |
| `sort` | string | Sort field (default: createdAt) |
| `dir` | asc\|desc | Sort direction |

---

## Workers

| Method | Path | Description |
|--------|------|-------------|
| GET | `/workers` | List all workers |
| GET | `/workers/metrics` | System-wide metrics |
| GET | `/workers/:workerId` | Get worker detail + heartbeats |
| POST | `/workers/:workerId/drain` | Signal worker to drain |
| GET | `/workers/:workerId/heartbeats` | Time-series heartbeat data |

---

## Dead Letter Queue

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dlq` | List DLQ entries (filterable by queueId) |
| POST | `/dlq/:dlqId/replay` | Re-queue a dead job |
| DELETE | `/dlq/:dlqId` | Remove DLQ entry |
| POST | `/dlq/:dlqId/ai-summary` | Generate AI failure analysis |

---

## Retry Policies

| Method | Path | Description |
|--------|------|-------------|
| POST | `/retry-policies` | Create policy |
| GET | `/retry-policies` | List all policies |
| GET | `/retry-policies/:policyId` | Get policy |
| PATCH | `/retry-policies/:policyId` | Update policy |
| DELETE | `/retry-policies/:policyId` | Delete policy |

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Service health check |

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `INVALID_CREDENTIALS` | 401 | Bad email/password |
| `TOKEN_EXPIRED` | 401 | Refresh token expired |
| `FORBIDDEN` | 403 | Insufficient RBAC role |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate resource |
| `INVALID_STATE` | 409 | Invalid state transition |
| `QUEUE_PAUSED` | 409 | Queue is paused, cannot dispatch |
| `VALIDATION_ERROR` | 422 | Request body failed Zod validation |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
