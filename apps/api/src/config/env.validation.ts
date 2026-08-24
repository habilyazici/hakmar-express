import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const DURATION_PATTERN = /^\d+[smhd]$/;

/**
 * Boot-time contract for the environment.
 *
 * Without this, a missing or malformed variable surfaced late and cryptically:
 * an unset DATABASE_URL reached node-postgres as `undefined` and failed with
 * "SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string", and a
 * missing JWT_ACCESS_SECRET only threw on the first login attempt rather than
 * at startup. Validating here makes the process refuse to start with a message
 * that names the actual variable.
 */
export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  // 32 chars is the practical floor for an HS256 signing key; anything shorter
  // is brute-forceable offline once an attacker holds a single issued token.
  @IsString()
  @MinLength(32, {
    message:
      'JWT_ACCESS_SECRET must be at least 32 characters. Generate one with: openssl rand -hex 32',
  })
  JWT_ACCESS_SECRET!: string;

  @IsOptional()
  @Matches(DURATION_PATTERN, {
    message: 'JWT_ACCESS_EXPIRES_IN must look like 30s / 20m / 12h / 7d.',
  })
  JWT_ACCESS_EXPIRES_IN?: string;

  @IsOptional()
  @Matches(DURATION_PATTERN, {
    message: 'JWT_REFRESH_EXPIRES_IN must look like 30s / 20m / 12h / 7d.',
  })
  JWT_REFRESH_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  WEB_ORIGIN?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsString()
  TRUST_PROXY?: string;

  @IsOptional()
  @IsString()
  SEED_ADMIN_USERNAME?: string;

  @IsOptional()
  @IsString()
  SEED_ADMIN_PASSWORD?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    excludeExtraneousValues: false,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((e) => Object.values(e.constraints ?? {}).join('; '))
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${details}`);
  }

  return validated;
}
