import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../../generated/prisma/enums';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import type { AuthenticatedUser } from './types/authenticated-user.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Legacy app had no rate limiting anywhere — login was fully open to
  // brute-force. 5 attempts/min per IP here, well below the global default.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.ANALYST)
  @Get('profile')
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.getProfile(user.sub);
  }
}
