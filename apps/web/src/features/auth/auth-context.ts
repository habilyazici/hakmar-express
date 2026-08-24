import { createContext } from 'react';
import type { AuthUser } from './types';

export const REFRESH_TOKEN_KEY = 'hakmar.refreshToken';

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
