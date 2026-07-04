-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'SCHEDULED', 'CLAIMED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'DEAD');
CREATE TYPE "JobType" AS ENUM ('IMMEDIATE', 'DELAYED', 'SCHEDULED', 'RECURRING', 'BATCH');
CREATE TYPE "RetryStrategy" AS ENUM ('FIXED', 'LINEAR', 'EXPONENTIAL');
CREATE TYPE "WorkerStatus" AS ENUM ('ACTIVE', 'IDLE', 'DRAINING', 'OFFLINE');
CREATE TYPE "ExecutionStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED', 'TIMED_OUT');
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateTable: users
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateTable: refresh_tokens
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateTable: organizations
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- CreateTable: org_memberships
CREATE TABLE "org_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "org_memberships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "org_memberships_user_org_unique" UNIQUE ("user_id", "organization_id")
);
CREATE INDEX "org_memberships_user_id_idx" ON "org_memberships"("user_id");
CREATE INDEX "org_memberships_org_id_idx" ON "org_memberships"("organization_id");

-- CreateTable: projects
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "projects_org_slug_unique" UNIQUE ("organization_id", "slug")
);
CREATE INDEX "projects_org_id_idx" ON "projects"("organization_id");

-- CreateTable: retry_policies
CREATE TABLE "retry_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "strategy" "RetryStrategy" NOT NULL DEFAULT 'EXPONENTIAL',
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "base_delay_ms" INTEGER NOT NULL DEFAULT 1000,
    "max_delay_ms" INTEGER NOT NULL DEFAULT 3600000,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "retry_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable: queues
CREATE TABLE "queues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "retry_policy_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "concurrency_limit" INTEGER NOT NULL DEFAULT 10,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rate_limit_per_min" INTEGER,
    "job_timeout_ms" INTEGER NOT NULL DEFAULT 300000,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "queues_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "queues_project_slug_unique" UNIQUE ("project_id", "slug")
);
CREATE INDEX "queues_project_id_idx" ON "queues"("project_id");
CREATE INDEX "queues_paused_active_idx" ON "queues"("is_paused", "is_active");
CREATE INDEX "queues_priority_idx" ON "queues"("priority");

-- CreateTable: queue_shards
CREATE TABLE "queue_shards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "queue_id" UUID NOT NULL,
    "shard_key" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "queue_shards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "queue_shards_queue_shard_unique" UNIQUE ("queue_id", "shard_key")
);
CREATE INDEX "queue_shards_queue_id_idx" ON "queue_shards"("queue_id");

-- CreateTable: job_batches
CREATE TABLE "job_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "total_jobs" INTEGER NOT NULL DEFAULT 0,
    "pending_jobs" INTEGER NOT NULL DEFAULT 0,
    "done_jobs" INTEGER NOT NULL DEFAULT 0,
    "failed_jobs" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "job_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable: jobs
CREATE TABLE "jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "queue_id" UUID NOT NULL,
    "batch_id" UUID,
    "parent_job_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "type" "JobType" NOT NULL DEFAULT 'IMMEDIATE',
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "idempotency_key" VARCHAR(255),
    "run_at" TIMESTAMPTZ,
    "cron_expression" VARCHAR(100),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "timeout" INTEGER,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "claimed_by" VARCHAR(36),
    "claimed_at" TIMESTAMPTZ,
    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "jobs_idempotency_key_key" ON "jobs"("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
CREATE INDEX "jobs_queue_status_priority_idx" ON "jobs"("queue_id", "status", "priority" DESC, "created_at" ASC);
CREATE INDEX "jobs_status_idx" ON "jobs"("status");
CREATE INDEX "jobs_run_at_idx" ON "jobs"("run_at");
CREATE INDEX "jobs_batch_id_idx" ON "jobs"("batch_id");
CREATE INDEX "jobs_claimed_by_idx" ON "jobs"("claimed_by");
CREATE INDEX "jobs_parent_job_id_idx" ON "jobs"("parent_job_id");

-- CreateTable: workers
CREATE TABLE "workers" (
    "id" UUID NOT NULL,
    "hostname" VARCHAR(255) NOT NULL,
    "pid" INTEGER NOT NULL,
    "status" "WorkerStatus" NOT NULL DEFAULT 'IDLE',
    "concurrency" INTEGER NOT NULL DEFAULT 5,
    "active_jobs" INTEGER NOT NULL DEFAULT 0,
    "total_jobs_done" INTEGER NOT NULL DEFAULT 0,
    "queues" TEXT[] NOT NULL DEFAULT '{}',
    "version" VARCHAR(20),
    "started_at" TIMESTAMPTZ NOT NULL,
    "last_seen_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "workers_status_idx" ON "workers"("status");
CREATE INDEX "workers_last_seen_at_idx" ON "workers"("last_seen_at");

-- CreateTable: worker_heartbeats
CREATE TABLE "worker_heartbeats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "worker_id" UUID NOT NULL,
    "active_jobs" INTEGER NOT NULL,
    "memory_usage_bytes" BIGINT,
    "cpu_usage_percent" DOUBLE PRECISION,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "worker_heartbeats_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "worker_heartbeats_worker_ts_idx" ON "worker_heartbeats"("worker_id", "timestamp");

-- CreateTable: job_executions
CREATE TABLE "job_executions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "worker_id" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "duration_ms" INTEGER,
    "error" TEXT,
    "error_stack" TEXT,
    "result" JSONB,
    "memory_usage_bytes" BIGINT,
    CONSTRAINT "job_executions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "job_executions_job_id_idx" ON "job_executions"("job_id");
CREATE INDEX "job_executions_worker_id_idx" ON "job_executions"("worker_id");
CREATE INDEX "job_executions_started_at_idx" ON "job_executions"("started_at");

-- CreateTable: job_logs
CREATE TABLE "job_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "job_logs_job_ts_idx" ON "job_logs"("job_id", "timestamp");

-- CreateTable: scheduled_jobs
CREATE TABLE "scheduled_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_template_id" UUID NOT NULL,
    "queue_id" UUID NOT NULL,
    "cron_expression" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "timeout" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMPTZ,
    "next_run_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "scheduled_jobs_next_run_active_idx" ON "scheduled_jobs"("next_run_at", "is_active");
CREATE INDEX "scheduled_jobs_queue_id_idx" ON "scheduled_jobs"("queue_id");

-- CreateTable: dlq_entries
CREATE TABLE "dlq_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "queue_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "last_error" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "failed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replayed_at" TIMESTAMPTZ,
    "replay_job_id" UUID,
    "ai_summary" TEXT,
    CONSTRAINT "dlq_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dlq_entries_job_id_unique" UNIQUE ("job_id")
);
CREATE INDEX "dlq_entries_queue_id_idx" ON "dlq_entries"("queue_id");
CREATE INDEX "dlq_entries_failed_at_idx" ON "dlq_entries"("failed_at");

-- CreateTable: distributed_locks
CREATE TABLE "distributed_locks" (
    "key" VARCHAR(255) NOT NULL,
    "holder" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "distributed_locks_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "distributed_locks_expires_at_idx" ON "distributed_locks"("expires_at");

-- Foreign Keys
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "org_memberships" ADD CONSTRAINT "fk_memberships_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "org_memberships" ADD CONSTRAINT "fk_memberships_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "fk_projects_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "queues" ADD CONSTRAINT "fk_queues_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;
ALTER TABLE "queues" ADD CONSTRAINT "fk_queues_retry_policy" FOREIGN KEY ("retry_policy_id") REFERENCES "retry_policies"("id") ON DELETE SET NULL;
ALTER TABLE "queue_shards" ADD CONSTRAINT "fk_shards_queue" FOREIGN KEY ("queue_id") REFERENCES "queues"("id") ON DELETE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "fk_jobs_queue" FOREIGN KEY ("queue_id") REFERENCES "queues"("id") ON DELETE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "fk_jobs_batch" FOREIGN KEY ("batch_id") REFERENCES "job_batches"("id") ON DELETE SET NULL;
ALTER TABLE "jobs" ADD CONSTRAINT "fk_jobs_parent" FOREIGN KEY ("parent_job_id") REFERENCES "jobs"("id") ON DELETE SET NULL;
ALTER TABLE "job_executions" ADD CONSTRAINT "fk_executions_job" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;
ALTER TABLE "job_executions" ADD CONSTRAINT "fk_executions_worker" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE;
ALTER TABLE "job_logs" ADD CONSTRAINT "fk_logs_job" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;
ALTER TABLE "worker_heartbeats" ADD CONSTRAINT "fk_heartbeats_worker" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE;
ALTER TABLE "dlq_entries" ADD CONSTRAINT "fk_dlq_job" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;
