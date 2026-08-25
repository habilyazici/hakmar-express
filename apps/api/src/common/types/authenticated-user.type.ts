import type { Role as RoleContract } from '@hakmar/contracts';
import { Role } from '../../../generated/prisma/enums';

/** Decoded JWT payload attached to `req.user` by JwtStrategy. */
export interface AuthenticatedUser {
  sub: number;
  username: string;
  role: Role;
}

/**
 * Prisma generates Role as a union of its own; this proves it and the
 * union the web reads describe the same three roles. A role added to the
 * schema alone would otherwise reach the client as a string it has no
 * label for.
 */
import type { Assert, SameMembers, ValuesOf } from './contract-check';
export type _RoleContractMatches = Assert<
  SameMembers<ValuesOf<Role>, RoleContract>
>;
