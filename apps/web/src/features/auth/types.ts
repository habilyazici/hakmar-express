export type Role = 'SUPERADMIN' | 'ADMIN' | 'ANALYST';

export interface AuthUser {
  sub: number;
  username: string;
  role: Role;
}

// The refresh token is not in either payload any more: it lives only in an
// httpOnly cookie, so there is nothing for the client to receive or store.
export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
}
