import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common';
import { HealthService, type ReadinessReport } from './health.service';

/**
 * Two probes, because they answer two different questions and a deployment
 * does two different things with the answers.
 *
 * `/health` is liveness: is this process running and able to serve? It
 * deliberately touches nothing else. A liveness probe that fails when the
 * database does is how a database hiccup turns into a restart loop across
 * every replica — restarting the API cannot fix Postgres, and each restart
 * throws away a warm connection pool.
 *
 * `/health/ready` is readiness: can this instance actually answer a request?
 * That is the one a load balancer should poll and the one compose waits on
 * before starting anything that depends on the API, because an instance
 * whose database is unreachable answers every real route with a 500 while
 * reporting itself perfectly alive.
 *
 * Both skip the throttle: a probe polling every few seconds from one address
 * is exactly the traffic the per-IP limit exists to stop, and an instance
 * that rate-limits its own health check reports itself down under load —
 * precisely when the answer matters most.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @SkipThrottle()
  @Get()
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * 503 rather than 200-with-a-body when a dependency is down. The status
   * code is what a proxy, an orchestrator and a `curl -f` all actually read;
   * the message is for whoever then goes looking.
   *
   * It names the failing dependency and its reason, because a probe that
   * answers only "Service Unavailable" tells an operator nothing they did
   * not already know from the status code.
   */
  @Public()
  @SkipThrottle()
  @Get('ready')
  async ready(): Promise<ReadinessReport> {
    const report = await this.health.readiness();
    if (report.status !== 'ok') {
      throw new ServiceUnavailableException(describeFailures(report));
    }
    return report;
  }
}

function describeFailures(report: ReadinessReport): string {
  const down = Object.entries(report.checks)
    .filter(([, check]) => check.status === 'down')
    .map(([name, check]) => `${name} (${check.error ?? 'unknown'})`)
    .join(', ');
  return `Not ready: ${down}`;
}
