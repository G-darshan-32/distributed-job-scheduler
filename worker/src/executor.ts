import { Job } from '@prisma/client';
import { logger } from './logger';

export interface ExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  errorStack?: string;
}

/**
 * Job executor - simulates job execution.
 * In a real system, this would dispatch to handler functions
 * registered by job type/name, or execute user-supplied scripts.
 */
export async function executeJob(job: Job, timeoutMs: number): Promise<ExecutionResult> {
  const payload = job.payload as Record<string, unknown>;
  const jobType = String(payload.__type ?? job.name);

  logger.info('Executing job', { jobId: job.id, name: job.name, type: jobType });

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ success: false, error: 'Job timed out', errorStack: 'Timeout exceeded' });
    }, timeoutMs);

    runJobLogic(job, payload)
      .then((result) => {
        clearTimeout(timer);
        resolve({ success: true, result });
      })
      .catch((err: Error) => {
        clearTimeout(timer);
        resolve({ success: false, error: err.message, errorStack: err.stack });
      });
  });
}

async function runJobLogic(job: Job, payload: Record<string, unknown>): Promise<unknown> {
  // Simulate variable execution time based on payload
  const delay = typeof payload.simulateDelayMs === 'number' ? payload.simulateDelayMs : 100;
  const shouldFail = payload.simulateFail === true;

  await sleep(delay);

  if (shouldFail) {
    throw new Error(`Simulated failure for job ${job.name}`);
  }

  return {
    processed: true,
    jobId: job.id,
    processedAt: new Date().toISOString(),
    payload,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
