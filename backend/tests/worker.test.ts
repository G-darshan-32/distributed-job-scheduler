import { prisma } from '../src/lib/prisma';
import {
  createTestUser, createTestOrg, createTestProject, createTestQueue,
} from './helpers';

/**
 * Worker tests validate the atomic claim query and job state transitions
 * without running the full worker process.
 */
describe('Worker - Atomic Job Claiming', () => {
  let queueId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    const org = await createTestOrg(user.id);
    const project = await createTestProject(org.id);
    const queue = await createTestQueue(project.id);
    queueId = queue.id;
  });

  it('atomically claims one job and marks it CLAIMED', async () => {
    const job = await prisma.job.create({
      data: { queueId, name: 'claimable', status: 'PENDING', type: 'IMMEDIATE', payload: {} },
    });

    const workerId = 'worker-test-001';

    // Simulate the atomic claim SQL
    await prisma.$transaction(async (tx) => {
      const result = await tx.$queryRaw<{ id: string }[]>`
        SELECT j.id FROM jobs j
        JOIN queues q ON q.id = j.queue_id
        WHERE j.status = 'PENDING'
          AND q.is_paused = false
          AND q.is_active = true
        ORDER BY j.priority DESC, j.created_at ASC
        LIMIT 1
        FOR UPDATE OF j SKIP LOCKED
      `;

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(job.id);

      await tx.job.update({
        where: { id: result[0].id },
        data: { status: 'CLAIMED', claimedBy: workerId, claimedAt: new Date() },
      });
    });

    const updated = await prisma.job.findUnique({ where: { id: job.id } });
    expect(updated!.status).toBe('CLAIMED');
    expect(updated!.claimedBy).toBe(workerId);
  });

  it('does not claim from a paused queue', async () => {
    // Pause the queue
    await prisma.queue.update({ where: { id: queueId }, data: { isPaused: true } });

    await prisma.job.create({
      data: { queueId, name: 'paused-q-job', status: 'PENDING', type: 'IMMEDIATE', payload: {} },
    });

    const result = await prisma.$queryRaw<{ id: string }[]>`
      SELECT j.id FROM jobs j
      JOIN queues q ON q.id = j.queue_id
      WHERE j.status = 'PENDING'
        AND q.is_paused = false
        AND q.is_active = true
      LIMIT 1
      FOR UPDATE OF j SKIP LOCKED
    `;

    expect(result).toHaveLength(0);
  });

  it('does not exceed queue concurrency limit', async () => {
    // Set concurrency to 1 and mark 1 job already running
    await prisma.queue.update({ where: { id: queueId }, data: { concurrencyLimit: 1 } });

    await prisma.job.create({
      data: { queueId, name: 'running-job', status: 'RUNNING', type: 'IMMEDIATE', payload: {} },
    });

    await prisma.job.create({
      data: { queueId, name: 'waiting-job', status: 'PENDING', type: 'IMMEDIATE', payload: {} },
    });

    const result = await prisma.$queryRaw<{ id: string }[]>`
      SELECT j.id FROM jobs j
      JOIN queues q ON q.id = j.queue_id
      WHERE j.status = 'PENDING'
        AND q.is_paused = false
        AND q.is_active = true
        AND (
          SELECT COUNT(*) FROM jobs running
          WHERE running.queue_id = j.queue_id AND running.status = 'RUNNING'
        ) < q.concurrency_limit
      LIMIT 1
      FOR UPDATE OF j SKIP LOCKED
    `;

    expect(result).toHaveLength(0);
  });

  it('respects job priority ordering', async () => {
    const lowPriority = await prisma.job.create({
      data: { queueId, name: 'low', status: 'PENDING', type: 'IMMEDIATE', payload: {}, priority: 0 },
    });
    const highPriority = await prisma.job.create({
      data: { queueId, name: 'high', status: 'PENDING', type: 'IMMEDIATE', payload: {}, priority: 100 },
    });

    const result = await prisma.$queryRaw<{ id: string }[]>`
      SELECT j.id FROM jobs j
      JOIN queues q ON q.id = j.queue_id
      WHERE j.status = 'PENDING'
        AND q.is_paused = false
        AND q.is_active = true
      ORDER BY j.priority DESC, j.created_at ASC
      LIMIT 1
      FOR UPDATE OF j SKIP LOCKED
    `;

    expect(result[0].id).toBe(highPriority.id);
  });
});

describe('Worker - DLQ transition', () => {
  let queueId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    const org = await createTestOrg(user.id);
    const project = await createTestProject(org.id);
    const queue = await createTestQueue(project.id);
    queueId = queue.id;
  });

  it('moves exhausted jobs to DLQ', async () => {
    const job = await prisma.job.create({
      data: {
        queueId,
        name: 'exhausted',
        status: 'RUNNING',
        type: 'IMMEDIATE',
        payload: { simulateFail: true },
        attempts: 3,
        maxAttempts: 3,
      },
    });

    // Simulate DLQ transition
    await prisma.$transaction([
      prisma.job.update({
        where: { id: job.id },
        data: { status: 'DEAD', lastError: 'Simulated failure', completedAt: new Date() },
      }),
      prisma.dLQEntry.create({
        data: {
          jobId: job.id,
          queueId,
          reason: 'Exhausted 3 attempts',
          lastError: 'Simulated failure',
          attempts: 3,
          payload: {},
        },
      }),
    ]);

    const updated = await prisma.job.findUnique({ where: { id: job.id } });
    expect(updated!.status).toBe('DEAD');

    const dlqEntry = await prisma.dLQEntry.findUnique({ where: { jobId: job.id } });
    expect(dlqEntry).not.toBeNull();
    expect(dlqEntry!.attempts).toBe(3);
  });
});
