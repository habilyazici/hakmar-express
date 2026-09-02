import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma';
import { HealthService } from './health.service';

/**
 * The failure paths, which are the only ones that matter.
 *
 * The e2e suite covers "everything is up" against a real Postgres and Redis.
 * What it structurally cannot cover is a dependency being down — and that is
 * the entire reason this probe exists, so it is the part worth a unit test.
 */
describe('HealthService', () => {
  let service: HealthService;
  let prisma: { $queryRaw: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock };

  beforeAll(() => {
    // A failed probe logs its reason on purpose; silence it so a passing run
    // is not buried in expected error output.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    cache = {
      get: jest.fn().mockResolvedValue('ok'),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = moduleRef.get(HealthService);
  });

  it('reports ok when both dependencies answer', async () => {
    const report = await service.readiness();

    expect(report.status).toBe('ok');
    expect(report.checks.database.status).toBe('up');
    expect(report.checks.cache.status).toBe('up');
  });

  it('reports the database down, and says why', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('ECONNREFUSED 5433'));

    const report = await service.readiness();

    expect(report.status).toBe('degraded');
    expect(report.checks.database).toEqual({
      status: 'down',
      error: 'ECONNREFUSED 5433',
    });
    // One failing dependency does not make the other look broken.
    expect(report.checks.cache.status).toBe('up');
  });

  it('reports the cache down when Redis is unreachable', async () => {
    cache.set.mockRejectedValue(new Error('Connection is closed.'));

    const report = await service.readiness();

    expect(report.status).toBe('degraded');
    expect(report.checks.cache.status).toBe('down');
    expect(report.checks.database.status).toBe('up');
  });

  /**
   * A Redis that accepts connections but silently drops writes — out of
   * memory, or a replica in read-only mode — answers a ping perfectly
   * happily while every cache write in the application fails. So the probe
   * writes and reads back rather than pinging.
   */
  it('catches a cache that accepts a write and does not keep it', async () => {
    cache.set.mockResolvedValue(undefined);
    cache.get.mockResolvedValue(null);

    const report = await service.readiness();

    expect(report.checks.cache.status).toBe('down');
    expect(report.checks.cache.error).toMatch(/did not return the value/);
  });

  /**
   * Without a timeout an unreachable dependency does not fail the check, it
   * hangs it — which a load balancer reads as a slow instance rather than a
   * broken one, and the probe itself becomes the thing that never answers.
   */
  it('fails a dependency that never answers rather than hanging on it', async () => {
    jest.useFakeTimers();
    prisma.$queryRaw.mockReturnValue(new Promise(() => {}));

    const pending = service.readiness();
    await jest.advanceTimersByTimeAsync(3_000);
    const report = await pending;

    expect(report.checks.database.status).toBe('down');
    expect(report.checks.database.error).toMatch(/did not answer within/);
    jest.useRealTimers();
  });

  /**
   * The reason reaches an unauthenticated endpoint, so it carries the
   * dependency's message and nothing about how the application is built.
   */
  it('never puts a stack trace in the reported reason', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('boom'));

    const report = await service.readiness();

    expect(report.checks.database.error).toBe('boom');
    expect(report.checks.database.error).not.toContain('at ');
  });
});
