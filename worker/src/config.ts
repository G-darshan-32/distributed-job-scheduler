import { z } from 'zod';

// Inline zod to avoid shared dependency complexity in this demo
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().default(1000),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().default(15000),
  WORKER_STALE_THRESHOLD_MS: z.coerce.number().default(60000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid worker environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
