import { UnauthorizedException } from '@nestjs/common';
import { Role } from '../common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma';
import { AuthService } from './auth.service';

// bcrypt is a native addon whose exports are non-configurable, so jest.spyOn
// cannot wrap them in place. Delegating to the real implementation through a
// counting mock keeps the hashing behaviour genuine while still letting the
// timing-safety test assert that compare() was reached.
jest.mock('bcrypt', () => {
  const actual = jest.requireActual<typeof import('bcrypt')>('bcrypt');
  return {
    ...actual,
    compare: jest.fn((data: string, hash: string): Promise<boolean> =>
      actual.compare(data, hash),
    ),
  };
});

const compareMock = bcrypt.compare as unknown as jest.Mock;

// expect.any() is typed as `any`; naming it once keeps the assertions below
// free of unsafe-assignment noise.
const anyDate = expect.any(Date) as Date;

const CONFIG: Record<string, string> = {
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  JWT_ACCESS_EXPIRES_IN: '20m',
  JWT_REFRESH_EXPIRES_IN: '7d',
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    adminUser: { findFirst: jest.Mock; update: jest.Mock };
    refreshToken: {
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      adminUser: { findFirst: jest.fn(), update: jest.fn() },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: 99 }),
        update: jest.fn(),
        // refresh() claims the presented token with a conditional updateMany;
        // count is how many rows it actually moved, and 1 means it won.
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('jwt') },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) => CONFIG[k],
            getOrThrow: (k: string) => CONFIG[k],
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('validateUser', () => {
    /**
     * Returning early when no user matched skipped bcrypt entirely, so a
     * request for a non-existent username answered in about a millisecond
     * while a real one spent ~100ms hashing. That difference is measurable
     * over the network and turns login into a username oracle.
     */
    it('still runs a bcrypt comparison when the username does not exist', async () => {
      compareMock.mockClear();
      prisma.adminUser.findFirst.mockResolvedValue(null);

      const result = await service.validateUser('ghost', 'whatever');

      expect(result).toBeNull();
      expect(compareMock).toHaveBeenCalledTimes(1);
      // ...and against a real hash, so the work is genuinely equivalent to
      // the found-user path rather than a token call that returns instantly.
      const [, hash] = compareMock.mock.calls[0] as [string, string];
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('returns null when the password does not match', async () => {
      prisma.adminUser.findFirst.mockResolvedValue({
        id: 1,
        username: 'admin',
        role: Role.ADMIN,
        passwordHash: await bcrypt.hash('correct', 4),
      });

      expect(await service.validateUser('admin', 'wrong')).toBeNull();
    });

    it('returns the user when the password matches', async () => {
      prisma.adminUser.findFirst.mockResolvedValue({
        id: 1,
        username: 'admin',
        role: Role.ADMIN,
        passwordHash: await bcrypt.hash('correct', 4),
      });

      const user = await service.validateUser('admin', 'correct');
      expect(user).not.toBeNull();
      expect(user!.username).toBe('admin');
    });
  });

  describe('login', () => {
    it('rejects invalid credentials with 401', async () => {
      prisma.adminUser.findFirst.mockResolvedValue(null);

      await expect(service.login('ghost', 'nope')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("issues a token pair and prunes that user's expired refresh tokens", async () => {
      prisma.adminUser.findFirst.mockResolvedValue({
        id: 7,
        username: 'admin',
        role: Role.ADMIN,
        passwordHash: await bcrypt.hash('pw', 4),
      });

      const result = await service.login('admin', 'pw');

      expect(result.accessToken).toBe('jwt');
      expect(result.refreshToken).toHaveLength(80); // 40 random bytes as hex
      expect(result.user).toEqual({
        sub: 7,
        username: 'admin',
        role: Role.ADMIN,
      });

      // Nothing used to delete refresh-token rows, so the table grew with
      // every single login and refresh for the life of the deployment.
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 7, expiresAt: { lt: anyDate } },
      });
    });

    it('never stores the raw refresh token, only its hash', async () => {
      prisma.adminUser.findFirst.mockResolvedValue({
        id: 7,
        username: 'admin',
        role: Role.ADMIN,
        passwordHash: await bcrypt.hash('pw', 4),
      });

      const result = await service.login('admin', 'pw');

      const calls = prisma.refreshToken.create.mock.calls as {
        data: { tokenHash: string };
      }[][];
      const stored = calls[0][0].data.tokenHash;
      expect(stored).not.toBe(result.refreshToken);
      expect(stored).toHaveLength(64); // sha256 hex
    });
  });

  describe('refresh', () => {
    it('rejects an unknown token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('nope')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('revokes the whole session family when an already-revoked token is replayed', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 1,
        userId: 7,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
        user: { id: 7, username: 'admin', role: Role.ADMIN, isActive: true },
      });

      await expect(service.refresh('replayed')).rejects.toThrow(
        /reuse detected/i,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 7, revokedAt: null },
        data: { revokedAt: anyDate },
      });
    });

    it('rejects an expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 1,
        userId: 7,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        user: { id: 7, username: 'admin', role: Role.ADMIN, isActive: true },
      });

      await expect(service.refresh('stale')).rejects.toThrow(/expired/i);
    });

    it('rejects a token belonging to a deactivated user', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 1,
        userId: 7,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86_400_000),
        user: { id: 7, username: 'admin', role: Role.ADMIN, isActive: false },
      });

      await expect(service.refresh('ok')).rejects.toThrow(/deactivated/i);
    });

    it('rotates: issues a new pair and marks the old token replaced', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 42,
        userId: 7,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86_400_000),
        user: { id: 7, username: 'admin', role: Role.ADMIN, isActive: true },
      });

      const pair = await service.refresh('valid');

      expect(pair.accessToken).toBe('jwt');
      // The revocation is the conditional claim, not part of the link.
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 42, revokedAt: null },
        data: { revokedAt: anyDate },
      });
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { replacedById: 99 },
      });
    });

    it('treats losing the claim race as a replay and revokes the family', async () => {
      // Both callers read revokedAt: null; the other one got there first, so
      // this update matches nothing. Without the claim both would have been
      // handed a live session off one presented token.
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 42,
        userId: 7,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86_400_000),
        user: { id: 7, username: 'admin', role: Role.ADMIN, isActive: true },
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.refresh('raced')).rejects.toThrow(/reuse detected/i);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 7, revokedAt: null },
        data: { revokedAt: anyDate },
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });
});
