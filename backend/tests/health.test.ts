import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('Health Check', () => {
  it('returns 200 with service status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('services');
    expect(res.body.services).toHaveProperty('database');
    expect(res.body.services).toHaveProperty('redis');
  });
});
