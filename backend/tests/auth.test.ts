import request from 'supertest';
import { createApp } from '../src/app';
import { createTestUser } from './helpers';

const app = createApp();

describe('Auth API', () => {
  describe('POST /api/v1/auth/register', () => {
    it('registers a new user and returns tokens', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'new@example.com',
        password: 'Password@123',
        name: 'New User',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('rejects duplicate email with 409', async () => {
      await createTestUser('dup@example.com');
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'dup@example.com',
        password: 'Password@123',
        name: 'Dup User',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects weak password with 422', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'weak@example.com',
        password: '123',
        name: 'Weak',
      });
      expect(res.status).toBe(422);
    });

    it('rejects invalid email with 422', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'not-an-email',
        password: 'Password@123',
        name: 'Bad Email',
      });
      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await createTestUser();
    });

    it('logs in with valid credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'Test@1234',
      });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('rejects invalid password with 401', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects unknown email with 401', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'ghost@example.com',
        password: 'Test@1234',
      });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns profile with valid token', async () => {
      await createTestUser();
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'Test@1234',
      });
      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('test@example.com');
    });

    it('rejects missing token with 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('rejects invalid token with 401', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('returns new token pair from valid refresh token', async () => {
      await createTestUser();
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'Test@1234',
      });
      const { refreshToken } = loginRes.body.data;

      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('rejects invalid refresh token with 401', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken: 'invalid-token',
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('revokes refresh token', async () => {
      await createTestUser();
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'Test@1234',
      });
      const { refreshToken } = loginRes.body.data;

      const logoutRes = await request(app).post('/api/v1/auth/logout').send({ refreshToken });
      expect(logoutRes.status).toBe(200);

      // Refresh should fail after logout
      const refreshRes = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
      expect(refreshRes.status).toBe(401);
    });
  });
});
