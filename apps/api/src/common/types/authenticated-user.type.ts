import type { Role } from './role';

/** Decoded JWT payload attached to `req.user` by JwtStrategy. */
export interface AuthenticatedUser {
  sub: number;
  username: string;
  role: Role;
}
