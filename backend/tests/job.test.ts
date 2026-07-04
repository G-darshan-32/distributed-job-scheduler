import request from 'supertest';
import { createApp } from '../src/app';
import {
  createTestUser, loginTestUser, createTestOrg,
  createTestProject, createTestQueue,
} from './helpers';

const app = createApp();

describe('Job API', () => {
  let token: string;
  let queueId: string;

  beforeEach(async () => {
    await createTestUser();
    token = await loginTestUser(app);
    const { prisma } = await import('../src/lib/prisma');
    const user = await prisma.user.findUnique({ where: { email: 'test@example.com' } });
    const org = await createTestOrg(user!.id);
    const project = await createTestProject(org.id);
    const queue = await createTestQueue(project.id);
    queueId = queue.id;
  });

  describe('POST /api/v1/queues/:queueId/jobs', () => {
    it('dispatches an immediate job', async () => {
      const res = await request(app)
        .post(`/api/v1/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'send-email', payload: { to: 'user@example.com' }, priority: 5 });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('send-email');
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.type).toBe('IMMEDIATE');
      expect(res.body.data.priority).toBe(5);
    });

    it('dispatches a delayed job with runAt in future', async () => {
      const runAt = new Date(Date.now() + 60000).toISOString();
      const res = await request(app)
        .post(`/api/v1/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'delayed-job', runAt });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('SCHEDULED');
      expect(res.body.data.type).toBe('DELAYED');
    });

    it('dispatches a recurring job with cron expression', async () => {
      const res = await request(app)
        .post(`/api/v1/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'cron-job', cronExpression: '*/5 * * * *' });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('SCHEDULED');
      expect(res.body.data.type).toBe('RECURRING');
      expect(res.body.data.cronExpression).toBe('*/5 * * * *');
    });

    it('rejects invalid cron expression with 422', async () => {
      const res = await request(app)
        .post(`/api/v1/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'bad-cron', cronExpression: 'not-a-cron' });

      expect(res.status).toBe(422);
    });

    it('is idempotent with idempotencyKey', async () => {
      const payload = { name: 'idempotent-job', payload: {}, idempotencyKey: 'key-abc-123' };

      const res1 = await request(app)
        .post(`/api/v1/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${token}`)
        .send(payload);
      expect(res1.status).toBe(201);

      const res2 = await request(app)
        .post(`/api/v1/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${token}`)
        .send(payload);
      expect(res2.status).toBe(201);

      // Same job returned
      expect(res1.body.data.id).toBe(res2.body.data.id);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .post(`/api/v1/queues/${queueId}/jobs`)
        .send({ name: 'no-auth-job' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/queues/:queueId/jobs/batch', () => {
    it('creates a batch of jobs', async () => {
      const res = await request(app)
        .post(`/api/v1/queues/${queueId}/jobs/batch`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchName: 'Test Batch',
          jobs: [
            { name: 'batch-job-1', payload: { index: 1 } },
            { name: 'batch-job-2', payload: { index: 2 } },
            { name: 'batch-job-3', payload: { index: 3 } },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.jobs).toHaveLength(3);
      expect(res.body.data.batch.totalJobs).toBe(3);
    });
  });

  describe('GET /api/v1/queues/:queueId/jobs', () => {
    beforeEach(async () => {
      const { prisma } = await import('../src/lib/prisma');
      await prisma.job.createMany({
        data: [
          { queueId, name: 'j1', status: 'PENDING', type: 'IMMEDIATE', payload: {} },
          { queueId, name: 'j2', status: 'COMPLETED', type: 'IMMEDIATE', payload: {} },
          { queueId, name: 'j3', status: 'FAILED', type: 'IMMEDIATE', payload: {} },
        ],
      });
    });

    it('lists all jobs with pagination', async () => {
      const res = await request(app)
        .get(`/api/v1/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
      expect(res.body.meta.total).toBe(3);
    });

    it('filters by status', async () => {
      const res = await request(app)
        .get(`/api/v1/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${token}`)
        .query({ status: 'COMPLETED' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe('COMPLETED');
    });

    it('filters by search term', async () => {
      const res = await request(app)
        .get(`/api/v1/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${token}`)
        .query({ search: 'j1' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('POST /api/v1/queues/:queueId/jobs/:jobId/cancel', () => {
    it('cancels a pending job', async () => {
      const { prisma } = await import('../src/lib/prisma');
      const job = await prisma.job.create({
        data: { queueId, name: 'cancel-me', status: 'PENDING', type: 'IMMEDIATE', payload: {} },
      });

      const res = await request(app)
        .post(`/api/v1/queues/${queueId}/jobs/${job.id}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('cannot cancel a running job', async () => {
      const { prisma } = await import('../src/lib/prisma');
      const job = await prisma.job.create({
        data: { queueId, name: 'running-job', status: 'RUNNING', type: 'IMMEDIATE', payload: {} },
      });

      const res = await request(app)
        .post(`/api/v1/queues/${queueId}/jobs/${job.id}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/v1/queues/:queueId/jobs/:jobId/retry', () => {
    it('retries a failed job', async () => {
      const { prisma } = await import('../src/lib/prisma');
      const job = await prisma.job.create({
        data: {
          queueId,
          name: 'failed-job',
          status: 'FAILED',
          type: 'IMMEDIATE',
          payload: {},
          attempts: 3,
          lastError: 'Timeout',
        },
      });

      const res = await request(app)
        .post(`/api/v1/queues/${queueId}/jobs/${job.id}/retry`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.attempts).toBe(0);
    });
  });
});
