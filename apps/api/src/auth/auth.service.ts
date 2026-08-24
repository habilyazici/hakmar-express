import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Role } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './types/authenticated-user.type';

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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.prisma.adminUser.findFirst({
      where: { username, isActive: true },
    });
    if (!user) return null;
    const matches = await bcrypt.compare(password, user.passwordHash);
    return matches ? user : null;
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
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
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

    if (previousTokenId) {
      await this.prisma.refreshToken.update({
        where: { id: previousTokenId },
        data: { revokedAt: new Date(), replacedById: created.id },
      });
    }

    return { accessToken, refreshToken: refreshTokenPlain };
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
