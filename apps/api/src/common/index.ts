/**
 * Shared kernel: the cross-cutting pieces every module is allowed to use.
 *
 * The one rule that keeps this a kernel rather than a junk drawer is that
 * nothing in here may import from a feature module — the dependency arrow
 * only ever points inwards. `AuthenticatedUser` lives here for exactly that
 * reason: RolesGuard and @CurrentUser need the shape of a principal, and
 * having them reach into `auth/` for it pointed the arrow the wrong way.
 */
export * from './crud/crud.service';
export * from './crud/limit-query.dto';
export * from './crud/pagination.dto';
export * from './decorators/current-user.decorator';
export * from './decorators/public.decorator';
export * from './decorators/roles.decorator';
export * from './filters/all-exceptions.filter';
export * from './guards/jwt-auth.guard';
export * from './guards/roles.guard';
export * from './interceptors/cache-invalidation.interceptor';
export * from './interceptors/transform.interceptor';
export * from './types/authenticated-user.type';
export * from './types/contract-check';
export * from './types/role';
