export const ROLES = ['SUPERADMIN', 'ADMIN', 'ANALYST'] as const;
export type Role = (typeof ROLES)[number];

/** The decoded access-token payload, and what /auth/login returns as `user`. */
export interface AuthUser {
  sub: number;
  username: string;
  role: Role;
}

// No refresh token in either payload: it lives only in an httpOnly cookie,
// so there is nothing here for the client to receive or store.
export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
}
