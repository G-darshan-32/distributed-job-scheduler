import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  TableOfContents, BorderStyle, Table, TableRow, TableCell, WidthType,
  PageBreak, ShadingType, convertInchesToTwip, Header, Footer,
  PageNumber, NumberFormat, LevelFormat, UnderlineType,
} from 'docx';
import * as fs from 'fs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const H1 = (text: string) => new Paragraph({
  text, heading: HeadingLevel.HEADING_1,
  spacing: { before: 400, after: 200 },
});

const H2 = (text: string) => new Paragraph({
  text, heading: HeadingLevel.HEADING_2,
  spacing: { before: 300, after: 150 },
});

const H3 = (text: string) => new Paragraph({
  text, heading: HeadingLevel.HEADING_3,
  spacing: { before: 200, after: 100 },
});

const P = (text: string, bold = false, italic = false) => new Paragraph({
  children: [new TextRun({ text, bold, italics: italic, size: 24 })],
  spacing: { after: 120 },
});

const BREAK = () => new Paragraph({ children: [new PageBreak()] });

const BULLET = (text: string, level = 0) => new Paragraph({
  text, bullet: { level },
  spacing: { after: 80 },
  indent: { left: convertInchesToTwip(0.25 * (level + 1)) },
});

const CODE = (text: string) => new Paragraph({
  children: [new TextRun({ text, font: 'Courier New', size: 20, color: '1F497D' })],
  spacing: { after: 80 },
  indent: { left: convertInchesToTwip(0.5) },
  shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' },
});

const CAPTION = (text: string) => new Paragraph({
  children: [new TextRun({ text, italics: true, size: 20, color: '595959' })],
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
});

const PLACEHOLDER = (label: string) => new Paragraph({
  children: [new TextRun({
    text: `[ SCREENSHOT PLACEHOLDER: ${label} ]`,
    bold: true, color: 'C00000', size: 22,
  })],
  alignment: AlignmentType.CENTER,
  spacing: { before: 200, after: 200 },
  shading: { type: ShadingType.CLEAR, fill: 'FFF2CC' },
  border: {
    top: { style: BorderStyle.SINGLE, size: 8, color: 'C00000' },
    bottom: { style: BorderStyle.SINGLE, size: 8, color: 'C00000' },
    left: { style: BorderStyle.SINGLE, size: 8, color: 'C00000' },
    right: { style: BorderStyle.SINGLE, size: 8, color: 'C00000' },
  },
});

function makeTable(headers: string[], rows: string[][]): Table {
  const headerCells = headers.map(h => new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: h, bold: true, size: 22 })],
    })],
    shading: { type: ShadingType.CLEAR, fill: '1F3864' },
    width: { size: Math.floor(9000 / headers.length), type: WidthType.DXA },
  }));

  const dataRows = rows.map(row => new TableRow({
    children: row.map(cell => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: cell, size: 22 })],
      })],
      width: { size: Math.floor(9000 / headers.length), type: WidthType.DXA },
    })),
  }));

  return new Table({
    rows: [new TableRow({ children: headerCells, tableHeader: true }), ...dataRows],
    width: { size: 9000, type: WidthType.DXA },
  });
}

// ─── Document sections ────────────────────────────────────────────────────────

const coverPage = [
  new Paragraph({ spacing: { before: 2000 } }),
  new Paragraph({
    children: [new TextRun({ text: 'Distributed Job Scheduler', bold: true, size: 56, color: '1F3864' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Production-Inspired Distributed Job Scheduling Platform', italics: true, size: 32, color: '595959' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Software Design Document', bold: true, size: 36, color: '2E75B6' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 800 },
  }),
  makeTable(
    ['Field', 'Value'],
    [
      ['Document Title', 'Distributed Job Scheduler — Software Design Document'],
      ['Subtitle', 'Production-Inspired Distributed Job Scheduling Platform'],
      ['Version', '1.0.0'],
      ['Date', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
      ['Status', 'Final'],
      ['Document Type', 'Software Design Document (SDD)'],
      ['Classification', 'Internal Engineering Documentation'],
    ]
  ),
  BREAK(),
];

const execSummary = [
  H1('1. Executive Summary'),
  P('The Distributed Job Scheduler is a production-grade platform engineered to reliably schedule, dispatch, and execute asynchronous background jobs across a horizontally scalable pool of worker processes. It addresses the fundamental challenge of reliable asynchronous task processing in modern distributed systems — ensuring that every job is executed exactly once, in priority order, with configurable retry behaviour and complete observability.'),
  H2('1.1 Business Problem'),
  P('Modern backend systems routinely need to defer work asynchronously: sending emails, generating reports, processing payments, syncing data, and running periodic maintenance tasks. Ad-hoc solutions using cron jobs, in-process task runners, or single-threaded queues fail at scale due to lack of visibility, unreliable delivery, duplicate execution, and zero fault tolerance.'),
  H2('1.2 Objectives'),
  BULLET('Provide a REST API for dispatching five job types: Immediate, Delayed, Scheduled, Recurring (cron), and Batch.'),
  BULLET('Guarantee exactly-once execution through atomic job claiming using PostgreSQL\'s SELECT FOR UPDATE SKIP LOCKED.'),
  BULLET('Support configurable retry strategies (Fixed, Linear, Exponential) with jitter and Dead Letter Queue for exhausted jobs.'),
  BULLET('Enable real-time dashboard visibility via WebSocket live updates.'),
  BULLET('Deliver a professional admin dashboard for queue management, job inspection, and worker monitoring.'),
  H2('1.3 Target Users'),
  makeTable(
    ['User Type', 'Description'],
    [
      ['Backend Engineers', 'Dispatch jobs via REST API from application code'],
      ['DevOps Engineers', 'Monitor workers, queues, and system health'],
      ['Platform Administrators', 'Manage organizations, projects, retry policies, and RBAC'],
      ['On-Call Engineers', 'Investigate failures, replay dead-letter jobs, review execution logs'],
    ]
  ),
  H2('1.4 Major Features'),
  BULLET('Multi-tenant hierarchy: Organizations → Projects → Queues → Jobs'),
  BULLET('Five job types: Immediate, Delayed, Scheduled, Recurring (cron), Batch'),
  BULLET('Atomic job claiming — zero duplicate execution under any concurrency level'),
  BULLET('Three retry strategies with exponential backoff and ±10% jitter'),
  BULLET('Dead Letter Queue with AI-assisted failure analysis (OpenAI integration)'),
  BULLET('WebSocket real-time updates for all dashboard views'),
  BULLET('Worker heartbeat monitoring with automatic stale-worker detection'),
  BULLET('Distributed scheduler locking to prevent dual cron execution'),
  BULLET('Role-Based Access Control: Owner / Admin / Member / Viewer'),
  BULLET('Idempotency key support for duplicate-safe job dispatch'),
  BULLET('Workflow dependencies via parent/child job relationships'),
  H2('1.5 High-Level Architecture'),
  P('The platform follows a three-tier architecture: a React single-page application communicates with an Express REST API over HTTPS, which persists state to a PostgreSQL database. A separate Worker process polls the database for pending jobs and executes them concurrently. A background Scheduler service promotes delayed jobs and triggers recurring cron jobs. Real-time updates are delivered via WebSocket connections from the API server to browser clients.'),
  H2('1.6 Technology Stack Summary'),
  makeTable(
    ['Layer', 'Technology'],
    [
      ['Frontend', 'React 18, TypeScript, Vite, TailwindCSS, TanStack Query, Recharts'],
      ['Backend', 'Node.js 20, Express 4, TypeScript, Prisma ORM'],
      ['Database', 'PostgreSQL 16'],
      ['Authentication', 'JSON Web Tokens (JWT) with refresh token rotation'],
      ['Real-time', 'WebSocket (ws library)'],
      ['Validation', 'Zod schema validation'],
      ['Logging', 'Winston with daily rotating files'],
      ['Testing', 'Jest, Supertest'],
      ['Deployment', 'Docker, Docker Compose, Railway, Vercel'],
    ]
  ),
  BREAK(),
];

const techStack = [
  H1('2. Technology Stack'),
  H2('2.1 Frontend Technologies'),
  H3('React 18'),
  P('React is used as the UI component framework. Version 18 introduces concurrent rendering, enabling smooth live-updating dashboards. React\'s component model maps cleanly to the dashboard\'s page-based navigation and reusable UI components (StatusBadge, StatCard, Modal, Pagination).'),
  H3('TypeScript'),
  P('TypeScript is used across all layers — frontend, backend, and worker. Strong typing eliminates entire classes of runtime errors, enables IDE autocompletion, and serves as living documentation for data shapes. All API response types, Prisma model types, and Zod schemas are TypeScript-typed end to end.'),
  H3('Vite'),
  P('Vite provides sub-second hot module replacement during development and optimised production builds using Rollup. It is significantly faster than webpack for TypeScript + React projects. The Vite dev server proxies /api and /ws requests to the backend, avoiding CORS issues during development.'),
  H3('TailwindCSS'),
  P('TailwindCSS provides utility-first CSS classes. The dark-mode dashboard is styled entirely with Tailwind utility classes without writing custom CSS files. Consistent spacing, colour palette, and responsive breakpoints are enforced through the tailwind.config.js theme extension.'),
  H3('TanStack Query (React Query v5)'),
  P('TanStack Query manages all server state — caching, background refetching, stale-while-revalidate, and invalidation. Each page uses useQuery with a configurable refetchInterval for live polling. useMutation handles POST/PATCH/DELETE operations with automatic cache invalidation on success.'),
  H3('Recharts'),
  P('Recharts renders responsive SVG charts: area charts for throughput, bar charts for job activity, pie charts for job status distribution, and line charts for worker heartbeat time-series. All chart data is derived from API responses.'),
  H3('Zustand'),
  P('Zustand manages global authentication state (access token, refresh token, user profile) with localStorage persistence via the persist middleware. It is intentionally minimal — only auth state lives globally; all server state lives in TanStack Query.'),
  H2('2.2 Backend Technologies'),
  H3('Node.js 20'),
  P('Node.js 20 LTS provides the JavaScript runtime for the API server and worker process. Its non-blocking event loop is well-suited for I/O-intensive workloads like queue polling and WebSocket message broadcasting. The single-threaded model simplifies concurrency reasoning while async/await handles all database operations.'),
  H3('Express 4'),
  P('Express provides the HTTP server framework. Its middleware-based pipeline is used for: authentication (JWT verification), request body parsing, rate limiting, CORS, security headers (Helmet), logging (Morgan), validation, and centralised error handling. Express was chosen for its maturity, ecosystem, and explicit control over the request pipeline.'),
  H3('Prisma ORM'),
  P('Prisma provides type-safe database access with an auto-generated client derived from the schema.prisma file. It handles connection pooling, query building, and migration management. The $queryRaw escape hatch is used for the SELECT FOR UPDATE SKIP LOCKED atomic claim query that Prisma\'s query builder does not support natively.'),
  H3('Winston'),
  P('Winston provides structured JSON logging with configurable transports. In production, all logs are written as JSON to daily rotating files (winston-daily-rotate-file) with 14-day retention. Console output uses colourised simple format in development.'),
  H3('Zod'),
  P('Zod provides runtime schema validation for all request bodies and environment variables. Every API endpoint validates its input against a Zod schema before the request reaches the service layer. Invalid requests return structured 422 responses with per-field error details.'),
  H2('2.3 Database'),
  H3('PostgreSQL 16'),
  P('PostgreSQL is the sole persistence layer for all application state. It was selected over alternatives (MongoDB, MySQL, Redis Streams) because: (1) SELECT FOR UPDATE SKIP LOCKED provides atomic, contention-free job claiming without external coordination; (2) JSONB columns store flexible job payloads efficiently; (3) ACID transactions guarantee atomic job state transitions; (4) pg_trgm extension enables efficient ILIKE search on job names.'),
  H2('2.4 Authentication'),
  H3('JSON Web Tokens'),
  P('JWTs provide stateless authentication. Access tokens expire in 15 minutes; refresh tokens expire in 7 days and are stored in the database for revocation support. On 401 responses, the Axios interceptor silently refreshes the token pair. Tokens are signed with HS256 using 32+ character secrets.'),
  H2('2.5 Deployment'),
  H3('Docker & Docker Compose'),
  P('Docker packages each service (backend, worker, frontend/nginx) into isolated containers with consistent runtime environments. Docker Compose orchestrates all services locally with health checks, dependency ordering, and shared networking. Multi-stage Dockerfiles minimise final image sizes by separating build and runtime stages.'),
  BREAK(),
];

const systemDesign = [
  H1('3. High-Level System Design'),
  H2('3.1 Architecture Overview'),
  P('The platform is composed of four independently deployable components: the React SPA (frontend), the Express API server (backend), the Node.js Worker process, and PostgreSQL. Redis is optional and used only for rate limiting — the application operates without it by falling back to in-memory stores.'),
  H2('3.2 System Architecture Diagram'),
  PLACEHOLDER('System Architecture Diagram — showing Frontend, Backend API, Worker Pool, PostgreSQL, Redis, and WebSocket connections'),
  CAPTION('Figure 3.1 — High-Level System Architecture'),
  H2('3.3 Component Descriptions'),
  H3('3.3.1 Frontend (React SPA)'),
  P('The frontend is a single-page application served by Nginx in production. It communicates with the backend exclusively over HTTPS REST APIs and a WebSocket connection. Authentication tokens are stored in localStorage via Zustand\'s persist middleware. The Vite proxy in development routes /api and /ws to localhost:4000.'),
  H3('3.3.2 Backend API (Express)'),
  P('The backend exposes 40+ REST endpoints organised into routers: auth, organizations, projects, queues, jobs, workers, DLQ, retry-policies, and health. Each request passes through: rate limiter → auth middleware → Zod validation → controller → service → Prisma → PostgreSQL. WebSocket connections are upgraded on the same HTTP server at path /ws.'),
  H3('3.3.3 Worker Service'),
  P('The worker is a standalone Node.js process that runs independently of the API server. It maintains a local Map of active job promises keyed by job ID, up to WORKER_CONCURRENCY concurrent jobs. Every WORKER_POLL_INTERVAL_MS it calls claimNextJob(), which executes an atomic SQL UPDATE...WHERE id = (SELECT...FOR UPDATE SKIP LOCKED) to atomically claim one pending job.'),
  H3('3.3.4 Scheduler'),
  P('The Scheduler runs inside the backend process as a node-cron task firing every 30 seconds. It performs two operations: (1) promotes SCHEDULED jobs whose run_at <= NOW() to PENDING status; (2) spawns new job instances for recurring cron jobs whose next_run_at has elapsed, then advances their next_run_at.'),
  H3('3.3.5 PostgreSQL'),
  P('PostgreSQL serves as both the job store and the distributed coordination layer. The schema contains 14 models. The critical design choice is using SELECT FOR UPDATE SKIP LOCKED for atomic job claiming — this eliminates the need for Redis, Kafka, or any external message broker for the core queue functionality.'),
  H3('3.3.6 WebSocket Server'),
  P('The WebSocket server is initialised on the same HTTP server as the Express app, listening at path /ws. Clients authenticate by passing their access token as a query parameter (?token=). Each client connection maintains a Set of subscribed channels. The broadcast() function delivers real-time events to all clients subscribed to a given channel.'),
  H2('3.4 Request Flow'),
  H3('3.4.1 Job Dispatch Flow'),
  BULLET('Client sends POST /api/v1/queues/:queueId/jobs with JWT Bearer token'),
  BULLET('Auth middleware verifies JWT signature and extracts user identity'),
  BULLET('Zod validates request body — name, type, payload, priority, etc.'),
  BULLET('JobService checks idempotency key; returns existing job if duplicate'),
  BULLET('Job row inserted into PostgreSQL with status PENDING'),
  BULLET('WebSocket broadcast fires to queue:{queueId} channel'),
  BULLET('Worker poll loop picks up the job within WORKER_POLL_INTERVAL_MS'),
  BULLET('Worker executes, updates status to COMPLETED or schedules retry'),
  H3('3.4.2 Authentication Flow'),
  BULLET('POST /auth/login validates credentials, returns accessToken (15m) + refreshToken (7d)'),
  BULLET('Client stores tokens in localStorage via Zustand'),
  BULLET('Every API request attaches Authorization: Bearer <accessToken>'),
  BULLET('On 401, Axios interceptor calls POST /auth/refresh with refreshToken'),
  BULLET('Refresh rotates both tokens; original refresh token is deleted from DB'),
  BREAK(),
];

const dbDesign = [
  H1('4. Database Design'),
  H2('4.1 Design Principles'),
  P('The schema is normalised to Third Normal Form (3NF). Every table has a UUID primary key (gen_random_uuid()) to enable distributed ID generation without coordination. Foreign keys enforce referential integrity with explicit CASCADE or SET NULL behaviours. JSONB columns store flexible job payloads without sacrificing query capability.'),
  H2('4.2 Entity Relationship Diagram'),
  PLACEHOLDER('ER Diagram — all 14 entities with relationships, cardinality notation, and key columns'),
  CAPTION('Figure 4.1 — Entity Relationship Diagram'),
  H2('4.3 Table Reference'),
  makeTable(
    ['Table', 'Purpose', 'PK', 'Key Relationships'],
    [
      ['users', 'User accounts with bcrypt-hashed passwords', 'id UUID', 'org_memberships, refresh_tokens'],
      ['refresh_tokens', 'JWT refresh token store for revocation', 'id UUID', 'users (CASCADE)'],
      ['organizations', 'Top-level multi-tenant namespace', 'id UUID', 'projects, org_memberships'],
      ['org_memberships', 'User:Org join table with RBAC role', 'id UUID', 'users, organizations (CASCADE)'],
      ['projects', 'Logical grouping of queues within an org', 'id UUID', 'organizations (CASCADE)'],
      ['retry_policies', 'Reusable retry configurations', 'id UUID', 'queues (SET NULL)'],
      ['queues', 'Named job queues with configuration', 'id UUID', 'projects (CASCADE)'],
      ['queue_shards', 'Horizontal sharding metadata', 'id UUID', 'queues (CASCADE)'],
      ['job_batches', 'Batch job progress counters', 'id UUID', 'jobs'],
      ['jobs', 'Core work unit — immutable payload, mutable status', 'id UUID', 'queues, batches, parent jobs'],
      ['job_executions', 'Immutable audit log of every execution attempt', 'id UUID', 'jobs, workers (CASCADE)'],
      ['job_logs', 'Per-job structured log lines (append-only)', 'id UUID', 'jobs (CASCADE)'],
      ['scheduled_jobs', 'Cron job next-run tracking', 'id UUID', 'queues'],
      ['workers', 'Worker process registry', 'id UUID', 'job_executions, heartbeats'],
      ['worker_heartbeats', 'Time-series worker liveness data', 'id UUID', 'workers (CASCADE)'],
      ['dlq_entries', 'Dead letter vault for exhausted jobs', 'id UUID', 'jobs (CASCADE, UNIQUE)'],
      ['distributed_locks', 'Advisory locks for scheduler coordination', 'key VARCHAR', '—'],
    ]
  ),
  H2('4.4 Critical Index Strategy'),
  makeTable(
    ['Index', 'Table', 'Columns', 'Purpose'],
    [
      ['jobs_queue_status_priority_idx', 'jobs', '(queue_id, status, priority DESC, created_at ASC)', 'Covers entire worker claim query predicate'],
      ['jobs_status_idx', 'jobs', '(status)', 'Scheduler promotion scans'],
      ['jobs_run_at_idx', 'jobs', '(run_at)', 'Delayed job filter'],
      ['jobs_idempotency_key', 'jobs', '(idempotency_key) UNIQUE WHERE NOT NULL', 'Idempotent dispatch'],
      ['job_logs_job_ts_idx', 'job_logs', '(job_id, timestamp)', 'Paginated log queries'],
      ['heartbeats_worker_ts', 'worker_heartbeats', '(worker_id, timestamp)', 'Heartbeat chart range queries'],
      ['locks_expires_at_idx', 'distributed_locks', '(expires_at)', 'Expired lock cleanup'],
      ['queues_paused_active_idx', 'queues', '(is_paused, is_active)', 'Worker claim queue filter'],
    ]
  ),
  H2('4.5 Transaction Strategy'),
  makeTable(
    ['Operation', 'Strategy', 'Rationale'],
    [
      ['Job claiming', 'Pessimistic (FOR UPDATE SKIP LOCKED)', 'Must prevent duplicate execution across workers'],
      ['DLQ transition', '$transaction([job.update, dlq.create])', 'Job status and DLQ entry must be atomic'],
      ['Batch creation', '$transaction(jobs.map(create))', 'All batch jobs inserted atomically'],
      ['Token refresh', 'Sequential (delete old, create new)', 'Rotation must not leave orphan tokens'],
      ['Scheduler promotion', 'updateMany (bulk)', 'No per-row lock needed for bulk promotion'],
      ['Worker registration', 'Simple INSERT', 'No contention — each worker has unique ID'],
    ]
  ),
  H2('4.6 Cascade Rules'),
  BULLET('Organization deleted → all projects, memberships cascade delete'),
  BULLET('Project deleted → all queues cascade delete'),
  BULLET('Queue deleted → all jobs cascade delete → all executions, logs, DLQ entries cascade delete'),
  BULLET('Worker deleted → all heartbeats and executions cascade delete'),
  BULLET('Job deleted → DLQ entry cascade delete (UNIQUE FK ensures one-to-one)'),
  BULLET('Retry policy deleted → queues SET NULL (policy removed, queue continues with no retry)'),
  BREAK(),
];

const jobLifecycle = [
  H1('5. Job Lifecycle'),
  H2('5.1 State Diagram'),
  PLACEHOLDER('Job State Diagram — PENDING → CLAIMED → RUNNING → COMPLETED/FAILED → SCHEDULED (retry) → DEAD → DLQ'),
  CAPTION('Figure 5.1 — Job State Machine'),
  H2('5.2 State Descriptions'),
  makeTable(
    ['State', 'Description', 'Entry Condition', 'Exit Condition'],
    [
      ['PENDING', 'Job is ready to be claimed by a worker', 'Immediate dispatch OR scheduler promotion', 'Worker claims the job'],
      ['SCHEDULED', 'Job is waiting for run_at time or retry delay', 'Delayed/recurring dispatch OR retry backoff', 'run_at <= NOW() → PENDING'],
      ['CLAIMED', 'Worker has locked the job row', 'Worker executes atomic UPDATE claim', 'Worker starts execution → RUNNING'],
      ['RUNNING', 'Worker is actively executing the job', 'Worker marks status after claim', 'Execution completes or fails'],
      ['COMPLETED', 'Job executed successfully', 'Executor returns success result', 'Terminal state'],
      ['FAILED', 'Execution failed, retries remaining', 'Executor returns error, attempt < max', 'Retry delay elapsed → SCHEDULED'],
      ['CANCELLED', 'Manually cancelled before execution', 'User calls POST /jobs/:id/cancel', 'Terminal state (can be retried)'],
      ['DEAD', 'All retry attempts exhausted', 'attempt == maxAttempts on failure', 'Terminal state → DLQ entry created'],
    ]
  ),
  H2('5.3 Transition Logic'),
  H3('5.3.1 Immediate Dispatch'),
  P('When a job is dispatched with type IMMEDIATE (default), it is inserted with status PENDING and runAt NULL. The worker\'s next poll cycle claims it.'),
  H3('5.3.2 Delayed Dispatch'),
  P('When runAt is a future timestamp, the job is inserted with status SCHEDULED and type DELAYED. The Scheduler service promotes it to PENDING when runAt <= NOW().'),
  H3('5.3.3 Recurring Jobs'),
  P('Cron jobs have status SCHEDULED and a matching ScheduledJob row. The Scheduler fires every 30 seconds, checks scheduled_jobs WHERE next_run_at <= NOW(), creates a new PENDING job instance, and advances next_run_at using the cron expression calculator.'),
  H3('5.3.4 Retry Transition'),
  P('On execution failure with attempts < maxAttempts: calculate retryDelay using the queue\'s RetryPolicy, set status = SCHEDULED, runAt = NOW() + retryDelay. The Scheduler promotes it back to PENDING when the delay elapses.'),
  H3('5.3.5 DLQ Transition'),
  P('When attempts == maxAttempts on failure, the job status is set to DEAD and a DLQEntry row is created in the same transaction. The DLQ entry stores the payload, last error, attempt count, and timestamp for later replay or analysis.'),
  BREAK(),
];

const workerLifecycle = [
  H1('6. Worker Lifecycle'),
  H2('6.1 Worker Lifecycle Diagram'),
  PLACEHOLDER('Worker Lifecycle Diagram — Startup → Register → Poll Loop → Claim → Execute → Complete/Fail/Retry → Heartbeat → Graceful Shutdown'),
  CAPTION('Figure 6.1 — Worker Process Lifecycle'),
  H2('6.2 Startup Sequence'),
  BULLET('1. Load environment variables from .env'),
  BULLET('2. Connect to PostgreSQL via Prisma'),
  BULLET('3. INSERT worker row with unique UUID, hostname, PID, status=IDLE'),
  BULLET('4. Start heartbeat timer (every HEARTBEAT_INTERVAL_MS, default 15s)'),
  BULLET('5. Start poll timer (every WORKER_POLL_INTERVAL_MS, default 1s)'),
  BULLET('6. Register SIGTERM/SIGINT handlers for graceful shutdown'),
  H2('6.3 Atomic Job Claiming'),
  P('The claim query is a single atomic UPDATE statement that avoids interactive transactions (which cause timeout issues on connection-pooled databases like Neon):'),
  CODE('UPDATE jobs SET status=\'CLAIMED\', claimed_by=$1, claimed_at=NOW()'),
  CODE('WHERE id = ('),
  CODE('  SELECT j.id FROM jobs j JOIN queues q ON q.id = j.queue_id'),
  CODE('  WHERE j.status = \'PENDING\' AND q.is_paused = false AND q.is_active = true'),
  CODE('  AND (j.run_at IS NULL OR j.run_at <= NOW())'),
  CODE('  AND (SELECT COUNT(*) FROM jobs r WHERE r.queue_id=j.queue_id AND r.status=\'RUNNING\') < q.concurrency_limit'),
  CODE('  ORDER BY j.priority DESC, j.created_at ASC LIMIT 1 FOR UPDATE OF j SKIP LOCKED'),
  CODE(') RETURNING id'),
  P('SKIP LOCKED means competing workers bypass rows locked by other transactions, eliminating contention and retry loops entirely.'),
  H2('6.4 Concurrency Model'),
  P('The worker maintains a Map<jobId, Promise<void>> of active executions. The poll loop runs while activeJobs.size < WORKER_CONCURRENCY, claiming and launching new jobs until the limit is reached. Each job promise removes itself from the map on completion, freeing a concurrency slot.'),
  H2('6.5 Heartbeat'),
  P('Every HEARTBEAT_INTERVAL_MS (default 15s), the worker atomically: (1) updates workers.last_seen_at and active_jobs count; (2) inserts a worker_heartbeats time-series row. The API server marks workers OFFLINE if last_seen_at < NOW() - WORKER_STALE_THRESHOLD_MS (default 60s).'),
  H2('6.6 Graceful Shutdown'),
  BULLET('SIGTERM/SIGINT received → set isDraining = true'),
  BULLET('Clear poll timer (stop claiming new jobs)'),
  BULLET('await Promise.allSettled(activeJobs) — wait up to 30 seconds'),
  BULLET('Update worker status to OFFLINE'),
  BULLET('Disconnect Prisma'),
  BULLET('process.exit(0)'),
  P('If active jobs do not complete within 30 seconds, a forced exit fires. In-flight jobs are left in RUNNING status and will be recovered by a future worker restart (stale claim detection).'),
  BREAK(),
];

const retryStrategy = [
  H1('7. Retry Strategy'),
  H2('7.1 Strategy Types'),
  makeTable(
    ['Strategy', 'Formula', 'Use Case'],
    [
      ['FIXED', 'delay = baseDelayMs', 'Predictable retry timing for external API rate limits'],
      ['LINEAR', 'delay = baseDelayMs × attempt', 'Gradual backoff for transient failures'],
      ['EXPONENTIAL', 'delay = baseDelayMs × multiplier^(attempt-1) ± 10% jitter', 'Standard backoff for most distributed system failures'],
    ]
  ),
  H2('7.2 Exponential Backoff with Jitter'),
  P('The exponential formula with default parameters (base=1000ms, multiplier=2, max=3600000ms):'),
  makeTable(
    ['Attempt', 'Base Delay', 'With Jitter Range', 'Capped At'],
    [
      ['1', '1,000 ms', '900 – 1,100 ms', '3,600,000 ms'],
      ['2', '2,000 ms', '1,800 – 2,200 ms', '3,600,000 ms'],
      ['3', '4,000 ms', '3,600 – 4,400 ms', '3,600,000 ms'],
      ['4', '8,000 ms', '7,200 – 8,800 ms', '3,600,000 ms'],
      ['5', '16,000 ms', '14,400 – 17,600 ms', '3,600,000 ms'],
    ]
  ),
  P('Jitter formula: delay = delay + (delay × 0.1 × (Math.random() × 2 - 1)). This spreads retries ±10% to prevent thundering herd when many jobs fail simultaneously due to a shared downstream outage.'),
  H2('7.3 DLQ Promotion'),
  P('When a job\'s attempt count equals maxAttempts on failure, both operations execute in a single PostgreSQL transaction: UPDATE jobs SET status=\'DEAD\' and INSERT INTO dlq_entries. This atomicity guarantee ensures no job can be both FAILED and absent from the DLQ, or in the DLQ but still showing FAILED status.'),
  H2('7.4 DLQ Replay'),
  P('The POST /dlq/:id/replay endpoint creates a new PENDING job with the same payload and queue as the original dead job, then records the replay relationship (replayedAt, replayJobId) on the DLQ entry. The original DLQ entry is retained for audit history.'),
  BREAK(),
];

const apiDocs = [
  H1('8. REST API Documentation'),
  H2('8.1 Base URL and Authentication'),
  P('Base URL: /api/v1. All authenticated endpoints require: Authorization: Bearer <accessToken>. All responses follow a consistent envelope:'),
  CODE('// Success: { "success": true, "data": { ... } }'),
  CODE('// Error:   { "success": false, "error": { "code": "ERROR_CODE", "message": "..." } }'),
  CODE('// List:    { "success": true, "data": [...], "meta": { "page", "limit", "total", "totalPages" } }'),
  H2('8.2 Authentication Endpoints'),
  makeTable(
    ['Method', 'Endpoint', 'Auth', 'Description'],
    [
      ['POST', '/auth/register', 'No', 'Register new user account'],
      ['POST', '/auth/login', 'No', 'Login, receive access + refresh token pair'],
      ['POST', '/auth/refresh', 'No', 'Rotate refresh token, receive new token pair'],
      ['POST', '/auth/logout', 'No', 'Revoke refresh token'],
      ['GET', '/auth/me', 'Yes', 'Get authenticated user profile'],
    ]
  ),
  H2('8.3 Organization Endpoints'),
  makeTable(
    ['Method', 'Endpoint', 'Auth', 'Description'],
    [
      ['POST', '/organizations', 'Yes', 'Create organization (caller becomes OWNER)'],
      ['GET', '/organizations', 'Yes', 'List organizations for authenticated user'],
      ['GET', '/organizations/:orgId', 'Yes', 'Get organization with members'],
      ['POST', '/organizations/:orgId/members', 'ADMIN+', 'Add member with role'],
      ['DELETE', '/organizations/:orgId/members/:userId', 'ADMIN+', 'Remove member'],
    ]
  ),
  H2('8.4 Queue Endpoints'),
  makeTable(
    ['Method', 'Endpoint', 'Description'],
    [
      ['POST', '/projects/:projectId/queues', 'Create queue with configuration'],
      ['GET', '/projects/:projectId/queues', 'List queues (paginated)'],
      ['GET', '/projects/:projectId/queues/:queueId', 'Get queue detail'],
      ['PATCH', '/projects/:projectId/queues/:queueId', 'Update queue configuration'],
      ['DELETE', '/projects/:projectId/queues/:queueId', 'Soft-delete queue'],
      ['POST', '/projects/:projectId/queues/:queueId/pause', 'Pause — workers skip this queue'],
      ['POST', '/projects/:projectId/queues/:queueId/resume', 'Resume job processing'],
      ['GET', '/projects/:projectId/queues/:queueId/stats', 'Job count by status + throughput'],
    ]
  ),
  H2('8.5 Job Endpoints'),
  makeTable(
    ['Method', 'Endpoint', 'Description'],
    [
      ['POST', '/queues/:queueId/jobs', 'Dispatch a single job (all types)'],
      ['POST', '/queues/:queueId/jobs/batch', 'Dispatch batch of up to 1000 jobs'],
      ['GET', '/queues/:queueId/jobs', 'List jobs (paginated, filterable, sortable)'],
      ['GET', '/queues/:queueId/jobs/metrics', 'Hourly/daily job counts + avg duration'],
      ['GET', '/queues/:queueId/jobs/:jobId', 'Get job with executions, logs, DLQ'],
      ['POST', '/queues/:queueId/jobs/:jobId/cancel', 'Cancel PENDING or SCHEDULED job'],
      ['POST', '/queues/:queueId/jobs/:jobId/retry', 'Re-queue FAILED/DEAD/CANCELLED job'],
      ['GET', '/queues/:queueId/jobs/:jobId/logs', 'Paginated execution logs'],
      ['GET', '/jobs/:jobId', 'Direct job access by ID (bypasses queue scope)'],
    ]
  ),
  H2('8.6 Job Dispatch Request Schema'),
  makeTable(
    ['Field', 'Type', 'Required', 'Description'],
    [
      ['name', 'string', 'Yes', 'Human-readable job identifier (max 200 chars)'],
      ['type', 'enum', 'No', 'IMMEDIATE (default), DELAYED, SCHEDULED, RECURRING, BATCH'],
      ['payload', 'object', 'No', 'Arbitrary JSON payload passed to executor'],
      ['priority', 'integer', 'No', 'Higher value = claimed first (default 0)'],
      ['runAt', 'ISO datetime', 'No', 'Future execution time for DELAYED/SCHEDULED jobs'],
      ['cronExpression', 'string', 'No', '5-part cron expression for RECURRING jobs'],
      ['maxAttempts', 'integer', 'No', 'Retry limit 1-100 (default 3)'],
      ['timeout', 'integer', 'No', 'Execution timeout in ms (overrides queue default)'],
      ['idempotencyKey', 'string', 'No', 'Unique key — returns existing job if duplicate'],
      ['parentJobId', 'UUID', 'No', 'Parent job ID for workflow dependencies'],
    ]
  ),
  H2('8.7 HTTP Status Codes'),
  makeTable(
    ['Code', 'Meaning', 'When Used'],
    [
      ['200', 'OK', 'Successful GET, PATCH, DELETE'],
      ['201', 'Created', 'Successful POST that creates a resource'],
      ['401', 'Unauthorized', 'Missing, invalid, or expired token'],
      ['403', 'Forbidden', 'Insufficient RBAC role'],
      ['404', 'Not Found', 'Resource does not exist'],
      ['409', 'Conflict', 'Duplicate slug, invalid state transition, paused queue'],
      ['422', 'Unprocessable Entity', 'Zod validation failure with field errors'],
      ['429', 'Too Many Requests', 'Rate limit exceeded'],
      ['500', 'Internal Server Error', 'Unexpected server-side error'],
      ['503', 'Service Unavailable', 'Health check degraded (DB or Redis unreachable)'],
    ]
  ),
  BREAK(),
];

const security = [
  H1('9. Authentication & Security'),
  H2('9.1 JWT Implementation'),
  P('Two token types are issued: a short-lived access token (15 minutes, HS256) for API authentication, and a long-lived refresh token (7 days) stored in the database for revocation. The refresh token table enables server-side logout — a token deleted from the database cannot be used to obtain new tokens even if it has not expired.'),
  H2('9.2 Refresh Token Rotation'),
  P('On every token refresh: (1) the old refresh token is deleted; (2) a new token pair is issued and the new refresh token is inserted. This rolling window prevents stolen refresh tokens from remaining valid indefinitely. The Axios interceptor queues concurrent 401 responses while one refresh is in flight to avoid race conditions.'),
  H2('9.3 Password Security'),
  P('Passwords are hashed with bcrypt at cost factor 12. The bcrypt work factor is deliberately set higher than the minimum (10) to increase resistance to offline brute-force attacks, while remaining fast enough for the typical login frequency. Password hashes are never returned in API responses.'),
  H2('9.4 Role-Based Access Control'),
  makeTable(
    ['Role', 'Hierarchy', 'Permissions'],
    [
      ['OWNER', '3', 'All operations including member management and deletion'],
      ['ADMIN', '2', 'All operations except transferring ownership'],
      ['MEMBER', '1', 'Create and manage queues and jobs'],
      ['VIEWER', '0', 'Read-only access to all resources'],
    ]
  ),
  H2('9.5 Security Headers'),
  P('The Helmet middleware sets the following HTTP security headers on every response: Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Strict-Transport-Security, X-XSS-Protection, and Referrer-Policy.'),
  H2('9.6 Input Validation'),
  P('Every request body is validated by a Zod schema before reaching the service layer. Zod provides: type coercion (coerce.number()), string sanitisation, enum membership checks, UUID format validation, and email format validation. Invalid requests return 422 with structured per-field error details.'),
  H2('9.7 SQL Injection Prevention'),
  P('Prisma\'s query builder uses parameterised queries for all ORM operations. Raw SQL (used only for the SKIP LOCKED claim query) uses Prisma\'s tagged template $queryRaw literal, which parameterises all interpolated values. No string concatenation is used to build SQL queries.'),
  H2('9.8 Rate Limiting'),
  P('Global rate limiting: 100 requests per minute per IP. Authentication endpoints: 20 requests per 15 minutes per IP. The rate limiter uses an in-memory store by default (no Redis dependency), suitable for single-instance deployments. Multi-instance deployments should replace with a Redis-backed store.'),
  BREAK(),
];

const concurrency = [
  H1('10. Concurrency & Reliability'),
  H2('10.1 Atomic Job Claiming'),
  P('The fundamental reliability guarantee of the platform is that no job is ever executed by more than one worker. This is achieved through PostgreSQL\'s row-level locking. The claim operation is a single SQL statement that atomically selects and updates a job row:'),
  CODE('UPDATE jobs SET status=\'CLAIMED\', claimed_by=$workerId, claimed_at=NOW()'),
  CODE('WHERE id = (SELECT j.id FROM jobs j JOIN queues q ON q.id=j.queue_id'),
  CODE('  WHERE j.status=\'PENDING\' ... ORDER BY priority DESC, created_at ASC'),
  CODE('  LIMIT 1 FOR UPDATE OF j SKIP LOCKED) RETURNING id'),
  P('SKIP LOCKED ensures that if two workers execute this query simultaneously, each receives a different job row. A worker that finds no unlocked PENDING rows receives an empty result set and waits for the next poll interval.'),
  H2('10.2 Idempotency'),
  P('Job dispatch supports client-supplied idempotency keys (unique, nullable VARCHAR(255)). If a job with the same idempotency key already exists, the existing job is returned without creating a duplicate. The partial unique index WHERE idempotency_key IS NOT NULL ensures the constraint only applies to keyed jobs.'),
  H2('10.3 Heartbeat-Based Crash Recovery'),
  P('Workers send heartbeats every 15 seconds. The API server\'s worker list endpoint marks workers OFFLINE if last_seen_at < NOW() - 60s. Jobs in RUNNING or CLAIMED state held by an OFFLINE worker can be identified and re-queued by an operator or automated recovery process. The schema supports this via the claimed_by column.'),
  H2('10.4 Distributed Scheduler Locking'),
  P('The Scheduler uses a distributed_locks table row with key \'scheduler:tick\' to prevent dual execution. The lock is acquired via an UPSERT with a 55-second TTL, checked within the same transaction, and released after the tick completes. If the scheduler process crashes, the lock expires naturally and the next process acquires it.'),
  H2('10.5 Queue Concurrency Limits'),
  P('The claim query enforces per-queue concurrency limits via a correlated subquery: AND (SELECT COUNT(*) FROM jobs WHERE queue_id=j.queue_id AND status=\'RUNNING\') < q.concurrency_limit. This is evaluated atomically with the claim, ensuring the limit is never exceeded even under high worker concurrency.'),
  BREAK(),
];

const observability = [
  H1('11. Observability'),
  H2('11.1 Structured Logging'),
  P('Winston is configured with two transports: a console transport (colorised simple format in development, JSON in production) and a DailyRotateFile transport writing JSON to logs/app-YYYY-MM-DD.log with 14-day retention and 20MB rotation. A separate error log captures ERROR-level events only. Uncaught exceptions and unhandled promise rejections are captured to dedicated log files.'),
  P('Every log entry includes: timestamp, log level, service name (djs-backend or djs-worker), and a structured metadata object. HTTP access logs are emitted via Morgan at the http level, skipping /health endpoint to avoid noise.'),
  H2('11.2 Execution History'),
  P('Every job execution attempt is recorded as an immutable job_executions row containing: worker ID, attempt number, status (STARTED/COMPLETED/FAILED/TIMED_OUT), start and end timestamps, duration in milliseconds, error message and stack trace, result JSON, and memory usage in bytes. This provides a complete audit trail for every job regardless of final outcome.'),
  H2('11.3 Job Logs'),
  P('Workers write structured log lines to the job_logs table during execution: a start log at attempt begin, progress logs from the executor, and a completion or failure log. These are surfaced on the Job Detail page in the dashboard with timestamp, level colour-coding, and full message text.'),
  H2('11.4 Health Check'),
  P('GET /api/v1/health returns a JSON response with: overall status (ok or degraded), per-service status for database and Redis, WebSocket client count, process uptime in seconds, and memory usage breakdown. The endpoint requires no authentication and is suitable for load balancer health probes.'),
  H2('11.5 Queue Statistics'),
  P('GET /projects/:projectId/queues/:queueId/stats returns job counts grouped by status (pending, running, completed, failed, dead, scheduled) plus throughput — the number of completed jobs in the last hour. This feeds the queue cards and dashboard charts.'),
  H2('11.6 Worker Metrics'),
  P('GET /workers returns all workers with their current status, active job count, total jobs processed, and last heartbeat time. GET /workers/:workerId/heartbeats returns time-series heartbeat data for the past N minutes, used to render the utilisation line charts on the Workers page.'),
  H2('11.7 Job Metrics'),
  P('GET /queues/:queueId/jobs/metrics returns hourly and daily job counts by status, plus average execution duration in milliseconds for completed jobs. These power the activity bar charts on the Jobs page.'),
  BREAK(),
];

const frontendDesign = [
  H1('12. Frontend Design'),
  H2('12.1 Application Architecture'),
  P('The frontend is a React 18 single-page application using React Router v6 for client-side routing. All server state is managed by TanStack Query. Global authentication state (tokens, user profile) is managed by Zustand with localStorage persistence. Forms use React Hook Form with Zod resolver for client-side validation matching server-side rules.'),
  H2('12.2 Page Inventory'),
  makeTable(
    ['Route', 'Page', 'Primary Purpose'],
    [
      ['/login', 'LoginPage', 'JWT credential authentication'],
      ['/dashboard', 'DashboardPage', 'System overview with charts and health status'],
      ['/projects', 'ProjectsPage', 'Project list and creation'],
      ['/projects/:id/queues', 'QueuesPage', 'Queue management, pause/resume, stats'],
      ['/queues/:id/jobs', 'JobsPage', 'Job table, dispatch modal, metrics chart'],
      ['/jobs/:id', 'JobDetailPage', 'Full job detail — logs, executions, payload, result'],
      ['/workers', 'WorkersPage', 'Worker registry with heartbeat charts'],
      ['/dlq', 'DLQPage', 'Dead letter queue with replay and AI summary'],
      ['/retry-policies', 'RetryPoliciesPage', 'Retry policy CRUD'],
      ['/settings', 'SettingsPage', 'Profile and system health'],
    ]
  ),
  H2('12.3 Real-Time Updates'),
  P('The WebSocket client in src/lib/websocket.ts connects to /ws with the access token as a query parameter. It subscribes to channel * on connect, receiving all broadcast events. The useWebSocket hook registers per-component handlers. JobsPage subscribes to queue:{queueId} and calls refetch() on any incoming event, triggering an immediate TanStack Query cache update without full page reload.'),
  H2('12.4 Component Library'),
  makeTable(
    ['Component', 'Purpose', 'Key Props'],
    [
      ['Layout', 'Sidebar navigation + auth guard + WS lifecycle', 'children via Outlet'],
      ['StatusBadge', 'Colour-coded job/worker status pill', 'status, size'],
      ['StatCard', 'Metric display card with icon', 'label, value, icon, color, trend'],
      ['PageHeader', 'Consistent page title + action slot', 'title, subtitle, actions'],
      ['Modal', 'Accessible dialog with Escape handler', 'title, onClose, size'],
      ['Pagination', 'Page navigation with total count', 'page, totalPages, total, onPage'],
      ['EmptyState', 'Zero-data placeholder with action', 'icon, title, description, action'],
      ['Spinner', 'Loading indicator (3 sizes)', 'size'],
    ]
  ),
  H2('12.5 API Client'),
  P('The Axios instance in src/lib/api.ts attaches the Authorization: Bearer header via a request interceptor. A response interceptor handles 401 responses: it pauses all concurrent requests, calls /auth/refresh, updates the Zustand store with new tokens, resumes queued requests, and redirects to /login if refresh fails. This prevents multiple simultaneous refresh calls through a shared isRefreshing flag and a waiter queue.'),
  BREAK(),
];

const screenshots = [
  H1('13. Application Screenshots'),
  H2('13.1 Login Page'),
  PLACEHOLDER('Login Page — dark background, centred card with email/password fields, "Sign in" button, demo credentials hint'),
  CAPTION('Figure 13.1 — Login Page. Provides JWT-based authentication. Demo credentials displayed at bottom.'),
  H2('13.2 Dashboard'),
  PLACEHOLDER('Dashboard — 4 stat cards (Total Jobs, Active Workers, Completed, Failed), Job Status pie chart, Service Health checks, Worker Status breakdown'),
  CAPTION('Figure 13.2 — System Dashboard. Real-time metrics refreshed every 10 seconds.'),
  H2('13.3 Projects Page'),
  PLACEHOLDER('Projects Page — grid of project cards with queue count badge, "New Project" button, create modal'),
  CAPTION('Figure 13.3 — Projects Page. Multi-tenant project management.'),
  H2('13.4 Queues Page'),
  PLACEHOLDER('Queues Page — list of queue rows showing name, status badge, job count, concurrency, pause/resume buttons'),
  CAPTION('Figure 13.4 — Queue Management. Each queue shows live job count and pause/resume controls.'),
  H2('13.5 Jobs Page'),
  PLACEHOLDER('Jobs Page — bar chart of hourly activity, search/filter bar, jobs table with status badges, priority, attempts, action buttons'),
  CAPTION('Figure 13.5 — Job Explorer. Shows hourly activity chart and paginated, filterable job table.'),
  H2('13.6 Job Detail Page'),
  PLACEHOLDER('Job Detail — status badge, metadata grid, JSON payload viewer, execution history list, log viewer with timestamps and level colours'),
  CAPTION('Figure 13.6 — Job Detail. Full execution history and structured log viewer.'),
  H2('13.7 Workers Page'),
  PLACEHOLDER('Workers Page — worker cards with hostname, PID, status, utilisation bar, heartbeat line chart'),
  CAPTION('Figure 13.7 — Worker Monitoring. Per-worker utilisation and 30-minute heartbeat chart.'),
  H2('13.8 Dead Letter Queue'),
  PLACEHOLDER('DLQ Page — list of dead job entries with error preview, replay/delete/AI summary buttons, expandable payload'),
  CAPTION('Figure 13.8 — Dead Letter Queue. Shows failed jobs with AI-generated root cause analysis.'),
  H2('13.9 Retry Policies'),
  PLACEHOLDER('Retry Policies — grid of policy cards showing strategy, max attempts, delay values, edit/delete buttons'),
  CAPTION('Figure 13.9 — Retry Policy Management. Reusable retry configurations with full CRUD.'),
  H2('13.10 Settings Page'),
  PLACEHOLDER('Settings — profile card, system health grid showing DB/Redis/WebSocket status, API URL, Swagger docs link'),
  CAPTION('Figure 13.10 — Settings. System health overview and API configuration.'),
  BREAK(),
];

const testing = [
  H1('14. Testing Strategy'),
  H2('14.1 Test Architecture'),
  P('Tests are integration tests running against a real PostgreSQL database. Jest is the test runner; Supertest drives HTTP requests against the Express app without binding to a port. Each test file creates fresh fixtures in beforeEach and deletes all test data in afterEach, ensuring complete isolation.'),
  H2('14.2 Test File Inventory'),
  makeTable(
    ['File', 'Type', 'Coverage', 'Test Count'],
    [
      ['auth.test.ts', 'Integration', 'Register, login, refresh, logout, /me, token validation', '12'],
      ['queue.test.ts', 'Integration', 'Create, list, pause/resume, stats, auth guard', '8'],
      ['job.test.ts', 'Integration', 'All job types, batch, cancel, retry, idempotency, filters', '14'],
      ['worker.test.ts', 'Integration', 'Atomic claim, priority ordering, concurrency limit, DLQ transition', '6'],
      ['retry.test.ts', 'Unit', 'All three strategies, capping, jitter bounds', '6'],
      ['scheduler.test.ts', 'Integration', 'Delayed job promotion, cron job spawning', '3'],
      ['retryPolicy.test.ts', 'Integration', 'CRUD operations, validation bounds', '6'],
      ['health.test.ts', 'Integration', 'Health check response shape and status codes', '1'],
    ]
  ),
  H2('14.3 Critical Test Cases'),
  H3('14.3.1 Atomic Claiming'),
  P('The worker test validates that two concurrent claim attempts on the same PENDING job result in only one worker receiving the job, with the other receiving NULL. This directly validates the SKIP LOCKED behaviour.'),
  H3('14.3.2 Idempotency'),
  P('The job test dispatches the same job twice with identical idempotency keys and asserts that both responses return the same job ID, with only one row in the database.'),
  H3('14.3.3 Concurrency Limit'),
  P('A queue is configured with concurrency_limit=1 and one job is set to RUNNING. The claim query is executed and asserted to return zero results, confirming the limit is enforced.'),
  H3('14.3.4 Retry Math'),
  P('Unit tests for calculateRetryDelay assert that exponential results fall within the ±10% jitter band, linear results are exactly baseDelayMs × attempt, and all results are capped at maxDelayMs.'),
  H2('14.4 Running Tests'),
  CODE('cd backend'),
  CODE('npm test                    # run all tests'),
  CODE('npm run test:coverage       # with coverage report'),
  CODE('npx jest tests/auth.test.ts # single file'),
  H2('14.5 Test Environment Requirements'),
  BULLET('PostgreSQL instance (can be same as development database)'),
  BULLET('DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET environment variables'),
  BULLET('Redis is NOT required — rate limiter uses in-memory store in tests'),
  BREAK(),
];

const deployment = [
  H1('15. Deployment Guide'),
  H2('15.1 Prerequisites'),
  makeTable(
    ['Dependency', 'Version', 'Purpose'],
    [
      ['Node.js', '20 LTS', 'Backend and worker runtime'],
      ['npm', '10+', 'Package management'],
      ['PostgreSQL', '15 or 16', 'Primary database (or Neon cloud)'],
      ['Docker', '24+ (optional)', 'Containerised deployment'],
      ['Git', 'Any', 'Source control'],
    ]
  ),
  H2('15.2 Environment Variables'),
  makeTable(
    ['Variable', 'Required', 'Description'],
    [
      ['DATABASE_URL', 'Yes', 'PostgreSQL connection string with sslmode=require'],
      ['JWT_SECRET', 'Yes', 'Minimum 32 characters — access token signing key'],
      ['JWT_REFRESH_SECRET', 'Yes', 'Minimum 32 characters — refresh token signing key'],
      ['NODE_ENV', 'Yes', 'development | production | test'],
      ['PORT', 'No', 'HTTP port (default 4000, Railway sets automatically)'],
      ['REDIS_URL', 'No', 'Redis connection string (app runs without Redis)'],
      ['WORKER_CONCURRENCY', 'No', 'Max parallel jobs per worker process (default 5)'],
      ['WORKER_POLL_INTERVAL_MS', 'No', 'Poll frequency in milliseconds (default 1000)'],
      ['OPENAI_API_KEY', 'No', 'Enables AI failure summaries in DLQ view'],
    ]
  ),
  H2('15.3 Local Development Setup'),
  CODE('git clone https://github.com/G-darshan-32/distributed-job-scheduler'),
  CODE('cp .env.example backend/.env   # edit DATABASE_URL and JWT secrets'),
  CODE(''),
  CODE('cd backend && npm install'),
  CODE('npx prisma generate && npx prisma migrate dev --name init'),
  CODE('npx ts-node prisma/seed.ts'),
  CODE('npm run dev                    # API on :4000'),
  CODE(''),
  CODE('cd worker && npm install && npm run dev   # worker process'),
  CODE('cd frontend && npm install && npm run dev # dashboard on :3000'),
  H2('15.4 Docker Compose Deployment'),
  CODE('cp .env.example .env           # set secrets'),
  CODE('docker compose up -d --build'),
  CODE('docker compose exec backend npx prisma migrate deploy'),
  CODE('docker compose exec backend npm run prisma:seed'),
  H2('15.5 Railway + Vercel Production Deployment'),
  BULLET('Push code to GitHub repository'),
  BULLET('Railway: New Project → GitHub repo → Root Directory: backend → add environment variables → Deploy'),
  BULLET('Railway: Add second service → same repo → Root Directory: worker → add DATABASE_URL → Deploy'),
  BULLET('Vercel: New Project → GitHub repo → Root Directory: frontend → add VITE_API_URL and VITE_WS_URL → Deploy'),
  BULLET('Run seed via Railway Console: node -e "require(\'./dist/...\')"'),
  H2('15.6 Database Migrations'),
  CODE('# Development'),
  CODE('npx prisma migrate dev --name describe_change'),
  CODE(''),
  CODE('# Production'),
  CODE('npx prisma migrate deploy'),
  BREAK(),
];

const designDecisions = [
  H1('16. Design Decisions & Trade-offs'),
  H2('16.1 PostgreSQL as Coordination Layer'),
  makeTable(
    ['Aspect', 'Detail'],
    [
      ['Decision', 'Use PostgreSQL for both persistence and distributed job claiming'],
      ['Rationale', 'SELECT FOR UPDATE SKIP LOCKED provides contention-free claiming without Redis, Kafka, or external brokers'],
      ['Advantage', 'Single infrastructure dependency; ACID guarantees; no dual-write consistency issues'],
      ['Trade-off', 'At extreme scale (>50k jobs/sec), PostgreSQL row locking becomes a bottleneck; mitigated by queue sharding'],
      ['Alternative Considered', 'Redis + BullMQ — rejected to avoid mandatory Redis dependency and to keep the system operable with only PostgreSQL'],
    ]
  ),
  H2('16.2 Custom Worker vs BullMQ'),
  makeTable(
    ['Aspect', 'Detail'],
    [
      ['Decision', 'Build a custom polling worker process'],
      ['Rationale', 'Assignment requirement; also demonstrates understanding of the underlying mechanics'],
      ['Advantage', 'Full transparency; no hidden Lua scripts; database-only operation; simpler operational model'],
      ['Trade-off', 'More code to maintain; missing built-in features like rate limiting and backpressure'],
      ['Alternative Considered', 'BullMQ (Redis Streams), Celery — not used per assignment constraints'],
    ]
  ),
  H2('16.3 WebSockets vs Server-Sent Events'),
  makeTable(
    ['Aspect', 'Detail'],
    [
      ['Decision', 'WebSocket (ws library) for real-time updates'],
      ['Rationale', 'Bidirectional protocol enables channel-based subscriptions from client to server'],
      ['Advantage', 'Clients subscribe to specific queue channels, reducing unnecessary rendering'],
      ['Trade-off', 'Requires sticky sessions in multi-instance deployment; SSE would be simpler for unidirectional updates'],
      ['Alternative Considered', 'SSE (EventSource) — simpler but unidirectional, no subscription filtering'],
    ]
  ),
  H2('16.4 Polling vs Event-Driven Worker'),
  makeTable(
    ['Aspect', 'Detail'],
    [
      ['Decision', 'Polling on a 1-3 second interval'],
      ['Rationale', 'Simple to implement; adequate for the target scale; no trigger or LISTEN/NOTIFY setup required'],
      ['Advantage', 'Works with any PostgreSQL host including cloud providers with connection limits'],
      ['Trade-off', 'Up to 3 seconds latency between job dispatch and execution start; generates constant DB queries'],
      ['Future Improvement', 'PostgreSQL LISTEN/NOTIFY via INSERT trigger would reduce latency to near-zero and eliminate idle polling'],
    ]
  ),
  H2('16.5 Database-Backed Distributed Locks'),
  makeTable(
    ['Aspect', 'Detail'],
    [
      ['Decision', 'PostgreSQL table-based advisory locks for scheduler coordination'],
      ['Rationale', 'Single infrastructure dependency; works without Redis'],
      ['Advantage', 'Lock expiry on process crash; visible in database for debugging'],
      ['Trade-off', 'Not suitable for multi-region active-active; Redis Redlock would be needed'],
      ['Alternative Considered', 'Redis Redlock — better for multi-region but adds required dependency'],
    ]
  ),
  BREAK(),
];

const futureEnhancements = [
  H1('17. Future Enhancements'),
  H2('17.1 High Priority'),
  H3('PostgreSQL LISTEN/NOTIFY'),
  P('Replace the 1-second poll loop with an INSERT trigger that calls pg_notify(\'job_available\', queue_id). Workers subscribe with LISTEN and wake immediately on new jobs, reducing dispatch latency from ~1s to <50ms and eliminating idle polling load on the database.'),
  H3('Redis Pub/Sub for Multi-Instance WebSocket'),
  P('Current WebSocket broadcasts only reach clients connected to the same backend instance. Adding Redis pub/sub as a message bus allows any backend instance to fan out events to all connected clients, enabling stateless horizontal scaling of the API tier.'),
  H3('Queue Sharding'),
  P('The queue_shards table is already in the schema. Implement consistent hashing to partition a high-volume queue across N shards, each independently claimable. This enables linear throughput scaling for queues exceeding ~10,000 jobs per minute.'),
  H2('17.2 Medium Priority'),
  H3('Workflow DAG Engine'),
  P('Extend the current single-level parent/child dependency to a full directed acyclic graph. A job declares waitForJobIds: string[] and transitions to PENDING only when all dependencies reach COMPLETED status.'),
  H3('Kubernetes Deployment'),
  P('Helm chart for backend + worker with HorizontalPodAutoscaler based on queue depth (exposed as Prometheus metric at /metrics), PodDisruptionBudget for rolling deployments, and ConfigMap for environment variables.'),
  H3('Prometheus Metrics Endpoint'),
  P('Expose GET /metrics in Prometheus exposition format: queue_depth_gauge, job_execution_duration_histogram, worker_active_jobs_gauge, retry_count_counter, dlq_entry_counter. Enables Grafana dashboards and alerting without the custom dashboard.'),
  H2('17.3 Lower Priority'),
  H3('CLI Tool'),
  P('A djs CLI for dispatching jobs, listing queues, and replaying DLQ entries from the terminal. Useful for operator scripting and CI/CD pipeline integration.'),
  H3('Webhook Callbacks'),
  P('On job completion/failure, POST to a configured callback URL with the job result. Enables serverless and event-driven architectures where the caller cannot hold a WebSocket connection.'),
  H3('Job Progress Reporting'),
  P('Allow running jobs to report progress (0-100%) via a dedicated endpoint. Stream progress updates to the dashboard via WebSocket for long-running jobs like batch data processing.'),
  BREAK(),
];

const conclusion = [
  H1('18. Conclusion'),
  P('The Distributed Job Scheduler demonstrates a complete, production-grade approach to asynchronous job processing. Every architectural decision is justified by engineering rationale — PostgreSQL\'s SELECT FOR UPDATE SKIP LOCKED eliminates the need for external message brokers; JWT refresh token rotation provides secure stateless authentication; Zod schema validation ensures type safety across the API boundary; and Winston structured logging provides the observability necessary for production operation.'),
  P('The platform achieves its core reliability guarantee — exactly-once job execution — through database-level atomicity rather than application-level coordination. This design choice significantly reduces operational complexity while providing the same correctness guarantees as more complex systems.'),
  P('The codebase demonstrates clean architecture principles: thin controllers delegate to service classes, services use repository patterns via Prisma, middleware is composable and testable, and the worker process is entirely independent of the API server. This separation enables each component to be scaled, tested, and deployed independently.'),
  P('The test suite covers the critical paths — authentication flows, queue lifecycle, all job types, atomic claiming behaviour, retry mathematics, and scheduler correctness — providing confidence for future modifications and extensions.'),
  P('The platform is immediately extensible toward the enhancements described in Section 17, including PostgreSQL NOTIFY for near-zero dispatch latency, Kubernetes deployment for cloud-native scaling, and workflow DAG support for complex job dependency graphs.'),
  new Paragraph({
    children: [new TextRun({ text: 'End of Document', bold: true, italics: true, size: 24, color: '595959' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 600 },
  }),
];

// ─── Assemble and build the document ─────────────────────────────────────────

const allSections = [
  ...coverPage,
  ...execSummary,
  ...techStack,
  ...systemDesign,
  ...dbDesign,
  ...jobLifecycle,
  ...workerLifecycle,
  ...retryStrategy,
  ...apiDocs,
  ...security,
  ...concurrency,
  ...observability,
  ...frontendDesign,
  ...screenshots,
  ...testing,
  ...deployment,
  ...designDecisions,
  ...futureEnhancements,
  ...conclusion,
];

const doc = new Document({
  creator: 'Distributed Job Scheduler Team',
  title: 'Distributed Job Scheduler — Software Design Document',
  description: 'Production-Inspired Distributed Job Scheduling Platform — Software Design Document v1.0.0',
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 24 },
      },
      heading1: {
        run: { font: 'Calibri', size: 36, bold: true, color: '1F3864' },
        paragraph: { spacing: { before: 400, after: 200 } },
      },
      heading2: {
        run: { font: 'Calibri', size: 28, bold: true, color: '2E75B6' },
        paragraph: { spacing: { before: 300, after: 150 } },
      },
      heading3: {
        run: { font: 'Calibri', size: 24, bold: true, color: '404040' },
        paragraph: { spacing: { before: 200, after: 100 } },
      },
    },
  },
  numbering: {
    config: [
      {
        reference: 'bullet-list',
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: '\u2022',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1.25),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.25),
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'Distributed Job Scheduler', bold: true, size: 18, color: '1F3864' }),
                new TextRun({ text: '  |  Software Design Document', size: 18, color: '595959' }),
              ],
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BFBFBF' } },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'Confidential — Internal Engineering Documentation  |  Page ', size: 18, color: '595959' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '595959' }),
                new TextRun({ text: ' of ', size: 18, color: '595959' }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '595959' }),
              ],
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 6, color: 'BFBFBF' } },
            }),
          ],
        }),
      },
      children: allSections,
    },
  ],
});

const OUTPUT_FILE = 'Distributed_Job_Scheduler_SDD.docx';

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUTPUT_FILE, buffer);
  console.log(`\nDocument generated successfully!`);
  console.log(`File: ${OUTPUT_FILE}`);
  console.log(`Size: ${(buffer.length / 1024).toFixed(1)} KB`);
});
