export type Role = 'SUPERADMIN' | 'ADMIN' | 'ANALYST';

export interface AuthUser {
  sub: number;
  username: string;
  role: Role;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}
