import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { AdminUserDto } from '@hakmar/contracts';
import { Role, type Page } from '../common';
import { AuthService } from '../auth';
import { PrismaService } from '../prisma';
import type { CreateUserDto, UpdateUserDto } from './dto/users.dto';

const BCRYPT_ROUNDS = 12;

/**
 * Every read of a user goes through this projection. passwordHash is never
 * in it, so a hash cannot reach a response by someone forgetting to strip it
 * — the default is safe rather than the exception being remembered.
 */
const PUBLIC_FIELDS = {
  id: true,
  username: true,
  fullName: true,
  email: true,
  jobTitle: true,
  role: true,
  isActive: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Was `{ [K in keyof typeof PUBLIC_FIELDS]: unknown }` — the field names
 * were checked and every value was `unknown`, so nothing downstream could
 * be wrong about a user. This is the shape the web compiles against, with
 * Date where the wire has a string.
 */
export type PublicUser = AdminUserDto<Date>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async list(
    limit: number,
    offset: number,
    search?: string,
  ): Promise<Page<PublicUser>> {
    const where = search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' as const } },
            { fullName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [items, total] = await Promise.all([
      this.prisma.adminUser.findMany({
        where,
        select: PUBLIC_FIELDS,
        take: limit,
        skip: offset,
        orderBy: { username: 'asc' },
      }),
      this.prisma.adminUser.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  findOne(id: number) {
    return this.prisma.adminUser.findUniqueOrThrow({
      where: { id },
      select: PUBLIC_FIELDS,
    });
  }

  async create({ password, ...profile }: CreateUserDto) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return this.prisma.adminUser.create({
      data: { ...profile, passwordHash },
      select: PUBLIC_FIELDS,
    });
  }

  async update(id: number, dto: UpdateUserDto, actingUserId: number) {
    const target = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id },
      select: { id: true, role: true, isActive: true },
    });

    // Locking yourself out is not a recoverable mistake through this API:
    // there would be no session left with which to undo it.
    if (id === actingUserId) {
      if (dto.isActive === false) {
        throw new BadRequestException(
          'You cannot deactivate your own account.',
        );
      }
      if (dto.role !== undefined && dto.role !== target.role) {
        throw new BadRequestException('You cannot change your own role.');
      }
    }

    const losesSuperadmin =
      target.role === Role.SUPERADMIN &&
      ((dto.role !== undefined && dto.role !== Role.SUPERADMIN) ||
        dto.isActive === false);
    if (losesSuperadmin) {
      await this.assertNotLastSuperadmin(id);
    }

    const user = await this.prisma.adminUser.update({
      where: { id },
      data: dto,
      select: PUBLIC_FIELDS,
    });

    // Role and active-flag changes both need the user's sessions revoked.
    //
    // The role travels inside the access token, so a demoted user keeps the
    // privileges it was minted with until it expires. Revoking the refresh
    // tokens stops the session renewing itself indefinitely and caps that
    // window at one access-token lifetime (JWT_ACCESS_EXPIRES_IN, 20 minutes
    // by default) instead of leaving it open for as long as the browser stays
    // open. Closing the window entirely would mean checking a denylist on
    // every request; that is a deliberate trade, not an oversight.
    const roleChanged = dto.role !== undefined && dto.role !== target.role;
    if (dto.isActive === false || roleChanged) {
      await this.auth.revokeAllSessions(id);
    }

    return user;
  }

  async setPassword(id: number, password: string) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.adminUser.update({
      where: { id },
      data: { passwordHash },
    });
    // An administrator resetting someone's password is very often a response
    // to that account being compromised, so existing sessions must not
    // survive it.
    await this.auth.revokeAllSessions(id);
  }

  async changeOwnPassword(
    id: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id },
      select: { passwordHash: true },
    });

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must differ from the current one.',
      );
    }

    await this.setPassword(id, newPassword);
  }

  async remove(id: number, actingUserId: number) {
    if (id === actingUserId) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    const target = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id },
      select: { role: true },
    });
    if (target.role === Role.SUPERADMIN) {
      await this.assertNotLastSuperadmin(id);
    }

    // RefreshToken cascades on delete, so sessions go with the account.
    await this.prisma.adminUser.delete({ where: { id } });
  }

  /**
   * Without this, demoting or deleting the final superadmin leaves an
   * installation where nobody can ever manage users again — an unrecoverable
   * state reachable by one ordinary-looking request.
   */
  private async assertNotLastSuperadmin(excludingId: number) {
    const remaining = await this.prisma.adminUser.count({
      where: {
        role: Role.SUPERADMIN,
        isActive: true,
        id: { not: excludingId },
      },
    });
    if (remaining === 0) {
      throw new ConflictException(
        'This is the last active superadmin; promote another one first.',
      );
    }
  }
}
