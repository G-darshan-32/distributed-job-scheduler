import request from 'supertest';
import { createApp } from '../src/app';
import {
  createTestUser, loginTestUser, createTestOrg,
  createTestProject, createTestQueue,
} from './helpers';

const app = createApp();

describe('Queue API', () => {
  let token: string;
  let projectId: string;

  beforeEach(async () => {
    await createTestUser();
    token = await loginTestUser(app);
    const user = await import('../src/lib/prisma').then(m =>
      m.prisma.user.findUnique({ where: { email: 'test@example.com' } })
    );
    const org = await createTestOrg(user!.id);
    const project = await createTestProject(org.id);
    projectId = project.id;
  });

  describe('POST /api/v1/projects/:projectId/queues', () => {
    it('creates a queue', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/queues`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My Queue', concurrencyLimit: 5, priority: 10 });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('My Queue');
      expect(res.body.data.slug).toBe('my-queue');
      expect(res.body.data.concurrencyLimit).toBe(5);
      expect(res.body.data.priority).toBe(10);
    });

    it('rejects duplicate queue name in same project', async () => {
      await request(app)
        .post(`/api/v1/projects/${projectId}/queues`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Dup Queue' });

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/queues`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Dup Queue' });

      expect(res.status).toBe(409);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/queues`)
        .send({ name: 'No Auth' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/projects/:projectId/queues', () => {
    it('lists queues with pagination', async () => {
      await createTestQueue(projectId, 'Q1');
      await createTestQueue(projectId, 'Q2');

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/queues`)
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(2);
    });
  });

  describe('POST /api/v1/projects/:projectId/queues/:queueId/pause', () => {
    it('pauses a queue', async () => {
      const q = await createTestQueue(projectId, 'PauseQ');

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/queues/${q.id}/pause`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isPaused).toBe(true);
    });

    it('resumes a paused queue', async () => {
      const q = await createTestQueue(projectId, 'ResumeQ');
      await request(app)
        .post(`/api/v1/projects/${projectId}/queues/${q.id}/pause`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/queues/${q.id}/resume`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isPaused).toBe(false);
    });
  });

  describe('GET /api/v1/projects/:projectId/queues/:queueId/stats', () => {
    it('returns queue stats', async () => {
      const q = await createTestQueue(projectId, 'StatsQ');
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/queues/${q.id}/stats`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        pending: expect.any(Number),
        running: expect.any(Number),
        completed: expect.any(Number),
        failed: expect.any(Number),
      });
    });
  });
});
