import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { agent, createTestApp } from './support/test-app';

const SUPERADMIN = process.env.SEED_ADMIN_USERNAME ?? 'superadmin';
const SUPERADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
const VALID_PASSWORD = 'CorrectHorse9Battery';
const COOKIE = 'hakmar_refresh';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superToken: string;
  let adminToken: string;

  async function login(username: string, password: string) {
    return agent(app)
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect(200);
  }

  /** Usernames this suite owns; anything left behind is cleared up front. */
  const OWNED = [
    'users-admin',
    'created-analyst',
    'second-super',
    'pw-target',
    'to-deactivate',
    'to-delete',
  ];

  async function purgeOwnedUsers() {
    const stale = await prisma.adminUser.findMany({
      where: { username: { in: OWNED } },
      select: { id: true },
    });
    const ids = stale.map((u) => u.id);
    if (ids.length === 0) return;
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.adminUser.deleteMany({ where: { id: { in: ids } } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    // A previous interrupted run can leave these behind, which would turn
    // every create in this suite into a 409 on the next attempt.
    await purgeOwnedUsers();

    superToken = (await login(SUPERADMIN, SUPERADMIN_PASSWORD)).body.data
      .accessToken as string;

    // A plain ADMIN, to prove user management really is SUPERADMIN-only.
    await prisma.adminUser.create({
      data: {
        username: 'users-admin',
        passwordHash: await bcrypt.hash(VALID_PASSWORD, 4),
        fullName: 'Plain Admin',
        role: Role.ADMIN,
        isActive: true,
      },
    });
    adminToken = (await login('users-admin', VALID_PASSWORD)).body.data
      .accessToken as string;
  });

  afterAll(async () => {
    await purgeOwnedUsers();
    await app.close();
  });

  describe('creation', () => {
    it('creates a user and never returns the password hash', async () => {
      const res = await agent(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          username: 'created-analyst',
          password: VALID_PASSWORD,
          fullName: 'Created Analyst',
          role: 'ANALYST',
        })
        .expect(201);

      expect(res.body.data.username).toBe('created-analyst');
      expect(res.body.data.role).toBe('ANALYST');
      expect(res.body.data.passwordHash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('$2b$');
    });

    it('lets the newly created user actually log in', async () => {
      const res = await login('created-analyst', VALID_PASSWORD);
      expect(res.body.data.user.role).toBe('ANALYST');
    });

    it('rejects a duplicate username with 409, not 500', async () => {
      const res = await agent(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          username: 'created-analyst',
          password: VALID_PASSWORD,
          fullName: 'Clash',
          role: 'ANALYST',
        });
      expect(res.status).toBe(409);
    });

    it.each([
      ['short', 'Ab1cdef'],
      ['no digit', 'AbcdefghijklMNOP'],
      ['no uppercase', 'abcdefghij123456'],
      ['no lowercase', 'ABCDEFGHIJ123456'],
    ])('rejects a weak password (%s)', async (_why, password) => {
      const res = await agent(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          username: `weak-${Math.random().toString(36).slice(2, 8)}`,
          password,
          fullName: 'Weak Password',
          role: 'ANALYST',
        });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown role', async () => {
      const res = await agent(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          username: 'bad-role',
          password: VALID_PASSWORD,
          fullName: 'Bad Role',
          role: 'ROOT',
        });
      expect(res.status).toBe(400);
    });
  });

  describe('listing', () => {
    it('never includes a password hash in the list', async () => {
      const res = await agent(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);

      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
      expect(JSON.stringify(res.body)).not.toContain('$2b$');
      expect(res.body.data.total).toBeGreaterThanOrEqual(2);
    });

    it('searches by username and full name', async () => {
      const res = await agent(app)
        .get('/api/v1/users')
        .query({ search: 'created-ana' })
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);
      expect(res.body.data.items).toHaveLength(1);
    });
  });

  describe('authorization', () => {
    it('denies a plain ADMIN access to user management', async () => {
      for (const [method, url] of [
        ['get', '/api/v1/users'],
        ['post', '/api/v1/users'],
      ] as const) {
        const res = await agent(app)
          [method](url)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});
        expect(res.status).toBe(403);
      }
    });

    it('rejects unauthenticated access', async () => {
      const res = await agent(app).get('/api/v1/users');
      expect(res.status).toBe(401);
    });
  });

  describe('lockout protection', () => {
    /**
     * Each of these is a single ordinary-looking request that would otherwise
     * leave the installation with nobody able to manage users, or with the
     * caller locked out of their own account.
     */
    it('refuses to let a superadmin deactivate themselves', async () => {
      const me = await prisma.adminUser.findUniqueOrThrow({
        where: { username: SUPERADMIN },
        select: { id: true },
      });

      const res = await agent(app)
        .patch(`/api/v1/users/${me.id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ isActive: false });
      expect(res.status).toBe(400);
    });

    it('refuses to let a superadmin change their own role', async () => {
      const me = await prisma.adminUser.findUniqueOrThrow({
        where: { username: SUPERADMIN },
        select: { id: true },
      });

      const res = await agent(app)
        .patch(`/api/v1/users/${me.id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ role: 'ANALYST' });
      expect(res.status).toBe(400);
    });

    it('refuses to let a superadmin delete themselves', async () => {
      const me = await prisma.adminUser.findUniqueOrThrow({
        where: { username: SUPERADMIN },
        select: { id: true },
      });

      const res = await agent(app)
        .delete(`/api/v1/users/${me.id}`)
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(400);
    });

    it('refuses to demote the last remaining superadmin', async () => {
      // Create a second superadmin, then demote the original: allowed,
      // because one remains. Then demoting the survivor must be refused.
      const second = await agent(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          username: 'second-super',
          password: VALID_PASSWORD,
          fullName: 'Second Super',
          role: 'SUPERADMIN',
        })
        .expect(201);
      const secondId = second.body.data.id as number;

      const secondSession = await login('second-super', VALID_PASSWORD);
      const secondToken = secondSession.body.data.accessToken as string;
      const secondCookie = (
        secondSession.headers['set-cookie'] as unknown as string[]
      )
        .find((c) => c.startsWith(`${COOKIE}=`))!
        .split(';')[0]
        .slice(COOKIE.length + 1);

      // Demoting the second superadmin from the first is fine — two exist.
      const demote = await agent(app)
        .patch(`/api/v1/users/${secondId}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ role: 'ADMIN' });
      expect(demote.status).toBe(200);
      expect(demote.body.data.role).toBe('ADMIN');

      // Only the original superadmin remains, so demoting it must be refused
      // outright — otherwise nobody could ever manage users again.
      const me = await prisma.adminUser.findUniqueOrThrow({
        where: { username: SUPERADMIN },
        select: { id: true },
      });
      const lastOne = await agent(app)
        .patch(`/api/v1/users/${me.id}`)
        .set('Authorization', `Bearer ${secondToken}`)
        .send({ role: 'ADMIN' });
      expect(lastOne.status).toBe(409);

      // Note the token used above still carries SUPERADMIN: the role lives in
      // the access token, so a demotion cannot retroactively invalidate one
      // already issued. What it does do is revoke the refresh tokens, which
      // caps the leftover privilege at a single access-token lifetime rather
      // than for as long as the session keeps renewing.
      const renew = await agent(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `${COOKIE}=${secondCookie}`);
      expect(renew.status).toBe(401);
    });
  });

  describe('password management', () => {
    let victimId: number;

    beforeAll(async () => {
      const res = await agent(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          username: 'pw-target',
          password: VALID_PASSWORD,
          fullName: 'Password Target',
          role: 'ANALYST',
        })
        .expect(201);
      victimId = res.body.data.id as number;
    });

    it('revokes existing sessions when an admin resets a password', async () => {
      const session = await login('pw-target', VALID_PASSWORD);
      const cookie = (session.headers['set-cookie'] as unknown as string[])
        .find((c) => c.startsWith(`${COOKIE}=`))!
        .split(';')[0];

      // The session works before the reset.
      const before = await agent(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie);
      expect(before.status).toBe(200);

      await agent(app)
        .patch(`/api/v1/users/${victimId}/password`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ password: 'BrandNewPass9Word' })
        .expect(204);

      // A reset is usually a response to compromise, so it must not survive.
      const after = await agent(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie);
      expect(after.status).toBe(401);

      await login('pw-target', 'BrandNewPass9Word');
    });

    it('lets a user change their own password with the correct current one', async () => {
      const token = (await login('pw-target', 'BrandNewPass9Word')).body.data
        .accessToken as string;

      await agent(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'BrandNewPass9Word',
          newPassword: 'ThirdPassword7Ok',
        })
        .expect(204);

      await login('pw-target', 'ThirdPassword7Ok');
    });

    it('rejects a self-service change with the wrong current password', async () => {
      const token = (await login('pw-target', 'ThirdPassword7Ok')).body.data
        .accessToken as string;

      const res = await agent(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'not-the-password',
          newPassword: 'FourthPassword7Ok',
        });
      expect(res.status).toBe(401);
    });

    it('rejects reusing the same password', async () => {
      const token = (await login('pw-target', 'ThirdPassword7Ok')).body.data
        .accessToken as string;

      const res = await agent(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'ThirdPassword7Ok',
          newPassword: 'ThirdPassword7Ok',
        });
      expect(res.status).toBe(400);
    });

    it('is available to every role, not just superadmin', async () => {
      // The ANALYST above already proved this; confirm for a plain ADMIN too.
      const res = await agent(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: VALID_PASSWORD,
          newPassword: 'AdminNewPass8Word',
        });
      expect(res.status).toBe(204);
    });
  });

  describe('deactivation', () => {
    it('stops a deactivated user from refreshing, and blocks a new login', async () => {
      const created = await agent(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          username: 'to-deactivate',
          password: VALID_PASSWORD,
          fullName: 'To Deactivate',
          role: 'ANALYST',
        })
        .expect(201);
      const id = created.body.data.id as number;

      const session = await login('to-deactivate', VALID_PASSWORD);
      const cookie = (session.headers['set-cookie'] as unknown as string[])
        .find((c) => c.startsWith(`${COOKIE}=`))!
        .split(';')[0];

      await agent(app)
        .patch(`/api/v1/users/${id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ isActive: false })
        .expect(200);

      const refresh = await agent(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie);
      expect(refresh.status).toBe(401);

      const relogin = await agent(app)
        .post('/api/v1/auth/login')
        .send({ username: 'to-deactivate', password: VALID_PASSWORD });
      expect(relogin.status).toBe(401);
    });
  });

  describe('deletion', () => {
    it('deletes a user and takes their sessions with them', async () => {
      const created = await agent(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          username: 'to-delete',
          password: VALID_PASSWORD,
          fullName: 'To Delete',
          role: 'ANALYST',
        })
        .expect(201);
      const id = created.body.data.id as number;

      await login('to-delete', VALID_PASSWORD);
      expect(
        await prisma.refreshToken.count({ where: { userId: id } }),
      ).toBeGreaterThan(0);

      await agent(app)
        .delete(`/api/v1/users/${id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .expect(204);

      // onDelete: Cascade on RefreshToken.user is what makes this work; under
      // the schema's previous default the delete would have failed outright.
      expect(await prisma.refreshToken.count({ where: { userId: id } })).toBe(
        0,
      );
      const gone = await agent(app)
        .get(`/api/v1/users/${id}`)
        .set('Authorization', `Bearer ${superToken}`);
      expect(gone.status).toBe(404);
    });
  });
});
