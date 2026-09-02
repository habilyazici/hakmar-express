import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { errorText } from '../common';
import { PrismaService } from '../prisma';

/** One dependency's answer: reachable, or the reason it was not. */
export interface DependencyCheck {
  status: 'up' | 'down';
  error?: string;
}

export interface ReadinessReport {
  status: 'ok' | 'degraded';
  checks: { database: DependencyCheck; cache: DependencyCheck };
}

/**
 * How long a probe waits for a dependency before calling it down.
 *
 * Without a timeout an unreachable Postgres does not fail the check — it
 * hangs it, which a load balancer reads as a slow instance rather than a
 * broken one, and the probe itself becomes the thing that never answers.
 */
const PROBE_TIMEOUT_MS = 3_000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async readiness(): Promise<ReadinessReport> {
    const [database, cache] = await Promise.all([
      this.check('database', () => this.prisma.$queryRaw`SELECT 1`),
      this.check('cache', () => this.probeCache()),
    ]);

    const status =
      database.status === 'up' && cache.status === 'up' ? 'ok' : 'degraded';
    return { status, checks: { database, cache } };
  }

  /**
   * A write and a read back, not a ping: a Redis that accepts connections
   * but rejects writes — out of memory, or a replica in read-only mode —
   * answers a ping perfectly happily while every cache write in the
   * application fails.
   */
  private async probeCache(): Promise<void> {
    const key = 'health:probe';
    await this.cache.set(key, 'ok', 5_000);
    const value = await this.cache.get<string>(key);
    if (value !== 'ok') {
      throw new Error('the cache did not return the value just written to it');
    }
  }

  private async check(
    name: string,
    probe: () => Promise<unknown>,
  ): Promise<DependencyCheck> {
    try {
      await withTimeout(probe(), PROBE_TIMEOUT_MS, name);
      return { status: 'up' };
    } catch (err) {
      // Logged here rather than only returned, so an instance that quietly
      // drops out of a load balancer leaves a reason behind in its own logs.
      this.logger.error(
        `Readiness probe for ${name} failed: ${errorText(err)}`,
      );
      return { status: 'down', error: messageOf(err) };
    }
  }
}

function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  name: string,
): Promise<T> {
  let timer: NodeJS.Timeout;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${name} did not answer within ${ms}ms`)),
      ms,
    );
  });
  // The losing promise is not cancellable, so clear the timer either way —
  // otherwise every successful probe holds the event loop open for its full
  // timeout, which is enough to stop the process exiting on SIGTERM.
  return Promise.race([work, expiry]).finally(() => clearTimeout(timer));
}

/**
 * The reason, without a stack trace. This reaches an unauthenticated
 * endpoint, so it says which dependency is down and nothing about how the
 * application is built.
 */
function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
