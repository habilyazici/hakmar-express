import type { Role as RoleContract } from '@hakmar/contracts';
import type { Role as RoleSchema } from '../../../generated/prisma/enums';
import type { Assert, SameMembers, ValuesOf } from './contract-check';

/**
 * Who someone is allowed to be.
 *
 * A domain concept, so it is declared here rather than imported from
 * `generated/prisma` — nineteen files used to reach into the generated
 * client for it, which made a schema artefact the definition of an idea the
 * guards, the decorators and the DTOs are all built on. Prisma still owns
 * the *column*; this owns the meaning.
 *
 * Declared as a const object rather than a TypeScript enum because it has to
 * survive as a runtime value: `@Roles(Role.ADMIN)` and `@IsEnum(Role)` both
 * read it at runtime.
 */
export const Role = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
  ANALYST: 'ANALYST',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

/**
 * Both directions, against both neighbours: the schema this is stored in and
 * the contract the web reads it from. A role added to schema.prisma alone
 * now fails the build here instead of reaching a client with no label for it.
 */
export type _RoleMatchesSchema = Assert<
  SameMembers<ValuesOf<Role>, ValuesOf<RoleSchema>>
>;
export type _RoleMatchesContract = Assert<
  SameMembers<ValuesOf<Role>, RoleContract>
>;
