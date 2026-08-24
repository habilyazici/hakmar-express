import { SetMetadata } from '@nestjs/common';
import { Role } from '../../../generated/prisma/enums';

export const ROLES_KEY = 'roles';

/** Require one of the given roles. Combined with the global RolesGuard, every
 * route needs an explicit @Roles(...) (or @Public()) — there is no opt-in
 * gap like the legacy app's unused checkRole middleware. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
