import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user.type';
import { Role } from '../types/role';

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

/**
 * Registered globally (APP_GUARD), fail-closed: a route with neither
 * @Public() nor @Roles(...) is denied by default. This makes the legacy
 * app's bug (RolesGuard-equivalent middleware existing but never applied to
 * any route) structurally impossible to repeat — you cannot forget to guard
 * a new endpoint, you can only forget to unlock it.
 */
@Injectable()
export class RolesGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException(
        'Route is missing @Roles() or @Public() — access denied by default.',
      );
    }

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role for this route.');
    }
    return true;
  }
}
