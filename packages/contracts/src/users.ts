import type { Role } from './auth';

/**
 * An account as every read of one returns it.
 *
 * `passwordHash` is absent by construction: the API selects this projection
 * rather than deleting fields afterwards, so a hash cannot reach a response
 * by someone forgetting to strip it. See ./tables for what `D` is.
 */
export interface AdminUserDto<D = string> {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  jobTitle: string | null;
  role: Role;
  isActive: boolean;
  lastLogin: D | null;
  createdAt: D;
  updatedAt: D;
}
