# Frontend

## Tech Stack

- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- React Router v6 (routing)
- TanStack Query v5 (server state, caching)
- Recharts (charts)
- React Hook Form + Zod (forms + validation)
- Zustand (auth state)
- Axios (HTTP client with interceptors)

## Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | LoginPage | JWT login form |
| `/dashboard` | DashboardPage | System overview + charts |
| `/projects` | ProjectsPage | Project list + create |
| `/projects/:id/queues` | QueuesPage | Queue management + stats |
| `/queues/:id/jobs` | JobsPage | Job table + dispatch + filters |
| `/jobs/:id` | JobDetailPage | Full job detail + logs + executions |
| `/workers` | WorkersPage | Worker list + heartbeat charts |
| `/dlq` | DLQPage | Dead letter queue + replay + AI summary |
| `/retry-policies` | RetryPoliciesPage | Retry policy CRUD |
| `/settings` | SettingsPage | Profile + system health |

## Architecture

```
App
├── Layout (sidebar nav + auth guard)
│   ├── DashboardPage
│   │   ├── StatCard × 4
│   │   ├── PieChart (job status distribution)
│   │   └── Health checks grid
│   ├── ProjectsPage
│   │   └── Modal (create project)
│   ├── QueuesPage
│   │   ├── Queue cards with pause/resume
│   │   └── Modal (create queue)
│   ├── JobsPage
│   │   ├── Activity BarChart
│   │   ├── Search + status filter
│   │   ├── Jobs table with inline actions
│   │   ├── Pagination
│   │   └── Modal (dispatch job)
│   ├── JobDetailPage
│   │   ├── Status + metadata
│   │   ├── Payload/result viewer
│   │   ├── Execution history
│   │   └── Log viewer
│   ├── WorkersPage
│   │   └── WorkerCard (heartbeat LineChart per worker)
│   ├── DLQPage
│   │   ├── Entry list with expand
│   │   └── AI summary + replay + delete
│   ├── RetryPoliciesPage
│   │   └── Policy cards + CRUD modal
│   └── SettingsPage
```

## API Client

`src/lib/api.ts` — Axios instance with:
- Automatic `Authorization: Bearer` header injection
- 401 → silent token refresh using refresh token
- Token rotation on each refresh
- Redirect to `/login` on refresh failure

## WebSocket Client

`src/lib/websocket.ts` — Custom WS client:
- Connects with `?token=` query param
- Auto-reconnects after 3s on disconnect
- Channel-based subscriptions: `queue:uuid`, `workers`, `scheduler`
- `useWebSocket(channel, handler)` hook for component-level subscriptions

## State Management

- **Server state**: TanStack Query with 30s stale time and per-page refetch intervals
- **Auth state**: Zustand + `localStorage` persistence
- **Form state**: React Hook Form with Zod resolvers

## Real-Time Updates

Pages that benefit from live updates use `useWebSocket` + `refetch()`:
- JobsPage: subscribes to `queue:{queueId}` — updates table on job state changes
- WorkersPage: polls every 10s + heartbeat charts auto-refresh
- DashboardPage: polls metrics every 10s
