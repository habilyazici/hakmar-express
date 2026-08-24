import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PaginationQueryDto } from '../common/crud/pagination.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ChangeOwnPasswordDto,
  CreateUserDto,
  SetPasswordDto,
  UpdateUserDto,
} from './dto/users.dto';
import { UsersService } from './users.service';

/**
 * Managing accounts and roles is SUPERADMIN's job alone — an ADMIN able to
 * mint accounts could promote itself, which would make the role boundary
 * decorative. The one exception is the self-service password change below.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /**
   * Declared before the ':id' routes: Express matches in registration order,
   * so 'me/password' would otherwise be swallowed by ':id' and fail on
   * ParseIntPipe.
   */
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.ANALYST)
  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeOwnPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangeOwnPasswordDto,
  ) {
    await this.users.changeOwnPassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Roles(Role.SUPERADMIN)
  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.users.list(query.limit ?? 50, query.offset ?? 0, query.search);
  }

  @Roles(Role.SUPERADMIN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.users.findOne(id);
  }

  @Roles(Role.SUPERADMIN)
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Roles(Role.SUPERADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.update(id, dto, actor.sub);
  }

  @Roles(Role.SUPERADMIN)
  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetPasswordDto,
  ) {
    await this.users.setPassword(id, dto.password);
  }

  @Roles(Role.SUPERADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.users.remove(id, actor.sub);
  }
}
