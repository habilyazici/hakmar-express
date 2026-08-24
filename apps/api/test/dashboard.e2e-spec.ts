import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { agent, createTestApp } from './support/test-app';

const TEST_USERNAME = 'e2e-analyst';
const TEST_PASSWORD = 'e2e-analyst-pass-123';

describe('Dashboard RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: number;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
    const user = await prisma.adminUser.create({
      data: {
        username: TEST_USERNAME,
        passwordHash,
        fullName: 'E2E Analyst',
        role: Role.ANALYST,
        isActive: true,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.adminUser.delete({ where: { id: userId } });
    await app.close();
  });

  it('lets an ANALYST read dashboard endpoints', async () => {
    const login = await agent(app)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD })
      .expect(200);

    const { accessToken } = login.body.data;

    for (const path of [
      '/api/v1/dashboard/summary',
      '/api/v1/dashboard/general-stats',
      '/api/v1/dashboard/performance/month',
      '/api/v1/dashboard/daily-summary',
      '/api/v1/dashboard/monthly-sales',
    ]) {
      const res = await agent(app)
        .get(path)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  it('returns 404 for an unknown performance period, not a 500', async () => {
    const login = await agent(app)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD })
      .expect(200);

    const res = await agent(app)
      .get('/api/v1/dashboard/performance/not-a-real-period')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
