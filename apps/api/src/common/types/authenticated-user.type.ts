import { Role } from '../../../generated/prisma/enums';

/** Decoded JWT payload attached to `req.user` by JwtStrategy. */
export interface AuthenticatedUser {
  sub: number;
  username: string;
  role: Role;
}
