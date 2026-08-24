import { INestApplication } from '@nestjs/common';
import { agent, createTestApp } from './support/test-app';

const USERNAME = process.env.SEED_ADMIN_USERNAME ?? 'superadmin';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unauthenticated request to a protected route', async () => {
    const res = await agent(app).get('/api/v1/dashboard/summary');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects bad credentials', async () => {
    const res = await agent(app)
      .post('/api/v1/auth/login')
      .send({ username: USERNAME, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('logs in, accesses a protected route, and rotates the refresh token', async () => {
    const login = await agent(app)
      .post('/api/v1/auth/login')
      .send({ username: USERNAME, password: PASSWORD })
      .expect(200);

    const { accessToken, refreshToken } = login.body.data;
    expect(typeof accessToken).toBe('string');
    expect(typeof refreshToken).toBe('string');

    const summary = await agent(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body.success).toBe(true);

    const refreshed = await agent(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect(refreshed.body.data.refreshToken).not.toBe(refreshToken);

    // Reusing the now-rotated-out token must fail and revoke the family.
    const reuse = await agent(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(reuse.status).toBe(401);

    // The token issued by the (now-invalidated-by-reuse) rotation is dead too.
    const afterReuse = await agent(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refreshed.body.data.refreshToken });
    expect(afterReuse.status).toBe(401);
  });
});
