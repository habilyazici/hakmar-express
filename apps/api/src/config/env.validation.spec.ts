import { validateEnv } from './env.validation';

const VALID = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
};

describe('validateEnv', () => {
  it('accepts a minimal valid environment', () => {
    expect(() => validateEnv({ ...VALID })).not.toThrow();
  });

  it.each(['DATABASE_URL', 'REDIS_URL', 'JWT_ACCESS_SECRET'])(
    'refuses to boot when %s is missing',
    (key) => {
      const env: Record<string, unknown> = { ...VALID };
      delete env[key];
      expect(() => validateEnv(env)).toThrow(key);
    },
  );

  it('rejects a JWT signing secret shorter than 32 characters', () => {
    expect(() =>
      validateEnv({ ...VALID, JWT_ACCESS_SECRET: 'too_short' }),
    ).toThrow(/at least 32 characters/);
  });

  it('rejects a malformed duration', () => {
    expect(() =>
      validateEnv({ ...VALID, JWT_ACCESS_EXPIRES_IN: '20 minutes' }),
    ).toThrow(/JWT_ACCESS_EXPIRES_IN/);
  });

  it.each(['30s', '20m', '12h', '7d'])('accepts the duration %s', (value) => {
    expect(() =>
      validateEnv({ ...VALID, JWT_ACCESS_EXPIRES_IN: value }),
    ).not.toThrow();
  });

  it('rejects a port outside the valid range', () => {
    expect(() => validateEnv({ ...VALID, PORT: 70000 })).toThrow(/PORT/);
  });

  it('names every offending variable at once rather than failing one at a time', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET: 'short' })).toThrow(
      /DATABASE_URL[\s\S]*REDIS_URL/,
    );
  });
});
