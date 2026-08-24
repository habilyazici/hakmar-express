import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Role } from '../../generated/prisma/enums';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LOGIN_THROTTLE, SESSION_THROTTLE } from './login-throttle';
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie';
import type { AuthenticatedUser } from './types/authenticated-user.type';

/**
 * @types/cookie-parser already augments Express's Request with `cookies`,
 * typed loosely as Record<string, any>. This narrows the one value we read
 * without redeclaring — and without an unchecked `any` reaching the service.
 */
function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Legacy app had no rate limiting anywhere — login was fully open to
  // brute-force. Strict per-IP limit here, well below the global default;
  // see login-throttle.ts for why it is configurable.
  @Public()
  @Throttle({ default: LOGIN_THROTTLE })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.auth.login(
      dto.username,
      dto.password,
    );
    setRefreshCookie(res, refreshToken, this.auth.refreshTtlMs());
    // The refresh token is deliberately absent from the body: it now exists
    // only as an httpOnly cookie that scripts cannot read.
    return { accessToken, user };
  }

  @Public()
  @Throttle({ default: SESSION_THROTTLE })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented = readRefreshCookie(req);
    if (!presented) {
      throw new UnauthorizedException('No refresh token.');
    }

    try {
      const { accessToken, refreshToken } = await this.auth.refresh(presented);
      setRefreshCookie(res, refreshToken, this.auth.refreshTtlMs());
      return { accessToken };
    } catch (err) {
      // A refresh that fails for any reason — expired, revoked, replayed —
      // leaves a cookie the server will never accept again. Clearing it stops
      // the client retrying a credential that is already dead.
      clearRefreshCookie(res);
      throw err;
    }
  }

  // Public because a client whose access token has already expired must
  // still be able to revoke its refresh token. Throttled because without an
  // explicit limit it inherited only the loose global one, leaving an
  // unauthenticated endpoint that writes to the database wide open.
  @Public()
  @Throttle({ default: SESSION_THROTTLE })
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = readRefreshCookie(req);
    if (presented) {
      await this.auth.logout(presented);
    }
    clearRefreshCookie(res);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.ANALYST)
  @Get('profile')
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.getProfile(user.sub);
  }
}
