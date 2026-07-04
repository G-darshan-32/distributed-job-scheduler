import request from 'supertest';
import { createApp } from '../src/app';
import { createTestUser, loginTestUser, createTestRetryPolicy } from './helpers';

const app = createApp();

describe('Retry Policy API', () => {
  let token: string;

  beforeEach(async () => {
    await createTestUser();
    token = await loginTestUser(app);
  });

  describe('POST /api/v1/retry-policies', () => {
    it('creates a retry policy', async () => {
      const res = await request(app)
        .post('/api/v1/retry-policies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'My Policy',
          strategy: 'EXPONENTIAL',
          maxAttempts: 5,
          baseDelayMs: 2000,
          maxDelayMs: 120000,
          multiplier: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('My Policy');
      expect(res.body.data.strategy).toBe('EXPONENTIAL');
      expect(res.body.data.maxAttempts).toBe(5);
    });

    it('validates multiplier bounds', async () => {
      const res = await request(app)
        .post('/api/v1/retry-policies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Bad Multiplier',
          strategy: 'EXPONENTIAL',
          maxAttempts: 3,
          baseDelayMs: 1000,
          maxDelayMs: 60000,
          multiplier: 100, // over max of 10
        });

      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/v1/retry-policies', () => {
    it('lists retry policies', async () => {
      await createTestRetryPolicy();
      await createTestRetryPolicy();

      const res = await request(app)
        .get('/api/v1/retry-policies')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('PATCH /api/v1/retry-policies/:policyId', () => {
    it('updates a policy', async () => {
      const policy = await createTestRetryPolicy();

      const res = await request(app)
        .patch(`/api/v1/retry-policies/${policy.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ maxAttempts: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.maxAttempts).toBe(10);
    });

    it('returns 404 for non-existent policy', async () => {
      const res = await request(app)
        .patch('/api/v1/retry-policies/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .send({ maxAttempts: 5 });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/retry-policies/:policyId', () => {
    it('deletes a policy', async () => {
      const policy = await createTestRetryPolicy();

      const res = await request(app)
        .delete(`/api/v1/retry-policies/${policy.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const get = await request(app)
        .get(`/api/v1/retry-policies/${policy.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(get.status).toBe(404);
    });
  });
});
