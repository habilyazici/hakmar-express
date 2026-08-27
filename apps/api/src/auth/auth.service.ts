import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma';
import { AuthenticatedUser, Role } from '../common';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const DURATION_UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * A real bcrypt hash (of a value nobody can log in with) so the
 * no-such-user path spends the same time in bcrypt.compare as a real one.
 */
const DUMMY_PASSWORD_HASH =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEe.uFxvfxdOsuHVeDrxLSpwq9Kzt4KZaPy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The bcrypt comparison runs even when no user matched, against a dummy
   * hash. Returning early instead leaked account existence through response
   * timing: a miss answered in ~1ms while a hit spent ~100ms in bcrypt, which
   * is trivially measurable and turns the login endpoint into a username
   * oracle. Both paths now cost the same.
   */
  async validateUser(username: string, password: string) {
    const user = await this.prisma.adminUser.findFirst({
      where: { username, isActive: true },
    });

    const matches = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    return user && matches ? user : null;
  }

  async login(
    username: string,
    password: string,
  ): Promise<TokenPair & { user: AuthenticatedUser }> {
    const user = await this.validateUser(username, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = await this.issueTokenPair(user.id, user.username, user.role);
    return {
      ...tokens,
      user: { sub: user.id, username: user.username, role: user.role },
    };
  }

  /**
   * Rotate-on-use refresh flow: the presented token is always revoked (either
   * successfully rotated, or — if it was already revoked — treated as a
   * replay of a stolen token, which revokes the entire session family. The
   * legacy app's refresh tokens never rotated and could not be revoked at all.
   */
  async refresh(refreshTokenPlain: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(refreshTokenPlain);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (existing.revokedAt) {
      await this.revokeAllSessions(existing.userId);
      throw new UnauthorizedException(
        'Refresh token reuse detected; all sessions revoked.',
      );
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired.');
    }

    if (!existing.user.isActive) {
      throw new UnauthorizedException('User is deactivated.');
    }

    // Claim the presented token before anything is issued against it.
    //
    // The read above and the revocation used to be separate statements with
    // the whole of issueTokenPair between them, so two refreshes arriving
    // together both saw `revokedAt: null` and both minted a session: one
    // presented token, two live families, and the reuse detection above
    // quietly not holding for the pair that caused it. A conditional update is
    // the claim — exactly one caller can move `revokedAt` away from null, and
    // a caller that loses that race is by definition presenting a token
    // somebody else has already rotated, which is the replay case.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) {
      await this.revokeAllSessions(existing.userId);
      throw new UnauthorizedException(
        'Refresh token reuse detected; all sessions revoked.',
      );
    }

    return this.issueTokenPair(
      existing.user.id,
      existing.user.username,
      existing.user.role,
      existing.id,
    );
  }

  async getProfile(userId: number) {
    const user = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        jobTitle: true,
        photoPath: true,
        role: true,
        lastLogin: true,
      },
    });
    return user;
  }

  async logout(refreshTokenPlain: string): Promise<void> {
    const tokenHash = this.hashToken(refreshTokenPlain);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Ends every live session a user has.
   *
   * Public because Users needs it — an administrator resetting a password,
   * deactivating an account or changing a role must not leave the affected
   * session renewing itself. It stays *here* rather than being a
   * `refreshToken.updateMany` inside UsersService: the refresh-token table
   * is Auth's, and reuse detection above depends on revocation always going
   * through one code path. A second module writing revokedAt directly is how
   * that invariant quietly stops holding.
   */
  async revokeAllSessions(userId: number): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Lifetime of a refresh token in milliseconds, so the controller can give
   * the cookie the same expiry as the row backing it. Without this the two
   * drift: a cookie outliving its row leaves the user with a credential the
   * server has already forgotten.
   */
  refreshTtlMs(): number {
    const configured =
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    return this.addDuration(new Date(0), configured).getTime();
  }

  private async issueTokenPair(
    userId: number,
    username: string,
    role: Role,
    previousTokenId?: number,
  ): Promise<TokenPair> {
    const payload: AuthenticatedUser = { sub: userId, username, role };
    const expiresIn = (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
      '20m') as `${number}${'s' | 'm' | 'h' | 'd'}`;
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn,
    });

    const refreshTokenPlain = randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(refreshTokenPlain);
    const expiresAt = this.addDuration(
      new Date(),
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    );

    const created = await this.prisma.refreshToken.create({
      data: { tokenHash, userId, expiresAt },
    });

    if (previousTokenId !== undefined) {
      // `revokedAt` is already set — refresh() claimed this row before calling
      // in, which is what makes the rotation atomic. All that is left is to
      // record which token replaced it, so the family stays traceable.
      await this.prisma.refreshToken.update({
        where: { id: previousTokenId },
        data: { replacedById: created.id },
      });
    }

    await this.pruneExpiredTokens(userId);

    return { accessToken, refreshToken: refreshTokenPlain };
  }

  /**
   * Every login and every refresh writes a row, and nothing ever removed
   * them — the table grew without bound for the life of the deployment.
   * Rows are only dropped once they are past their own expiry, so the
   * reuse-detection path above can still recognise a replayed token for as
   * long as that token could plausibly be presented.
   */
  private async pruneExpiredTokens(userId: number): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private addDuration(base: Date, duration: string): Date {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) {
      return new Date(base.getTime() + DURATION_UNIT_MS.d * 7);
    }
    const value = Number(match[1]);
    return new Date(base.getTime() + value * DURATION_UNIT_MS[match[2]]);
  }
}
