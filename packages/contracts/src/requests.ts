import type { Role } from './auth';
import type { DiscountScope, ForecastMetric, MapType } from './forecast';

/**
 * What the web sends, as opposed to what it reads back.
 *
 * The API validates every one of these with a class-validator DTO, and each
 * of those asserts itself against the type here — so a field the web sends
 * and the API does not accept is a build failure rather than a 400 the form
 * has to explain. `forbidNonWhitelisted` is on, which makes an unexpected
 * key a rejection rather than something quietly ignored.
 *
 * Only the shape is shared. The rules — password composition, the 1..24
 * horizon, which fields a discount scope makes mandatory — stay on the API,
 * because they are what the server has to enforce whatever a client
 * believes.
 */

export interface LoginBody {
  username: string;
  password: string;
}

export interface CreateUserBody {
  username: string;
  password: string;
  fullName: string;
  email?: string;
  jobTitle?: string;
  role: Role;
  isActive?: boolean;
}

/**
 * Username and password are absent on purpose. The username is the account's
 * stable identity, and the password has its own endpoint so that changing it
 * revokes the user's sessions.
 */
export interface UpdateUserBody {
  fullName?: string;
  email?: string;
  jobTitle?: string;
  role?: Role;
  isActive?: boolean;
}

export interface SetPasswordBody {
  password: string;
}

export interface ChangeOwnPasswordBody {
  currentPassword: string;
  newPassword: string;
}

/** Every field is optional; the API supplies the defaults. */
export interface ForecastRunBody {
  mapType?: MapType;
  metric?: ForecastMetric;
  periodMonths?: number;
  discountPct?: number;
  discountScope?: DiscountScope;
  discountTargetId?: number;
  costChangePct?: number;
  purchasingPowerPct?: number;
}
