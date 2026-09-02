import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type { Request } from 'express';
import { Observable, from, switchMap } from 'rxjs';
import { errorText } from '../errors/error-text';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Clears the response cache after a successful write to master data.
 *
 * The analytics routes cache for five to thirty minutes, which was harmless
 * while the catalog could only change through direct database access. Once
 * those records became editable through the API, a branch created in the
 * management screen stayed missing from every report until its cache entry
 * aged out — which reads as a broken report, not as a cache.
 *
 * Clearing the whole cache rather than computing which keys are affected is
 * deliberate: entries are keyed by URL, one master-data change can touch
 * almost every aggregate, and these writes are rare by definition. Paying a
 * full cache rebuild when someone adds a product is a far better trade than
 * showing them a stale one.
 *
 * Applied per controller rather than globally, so a POST that changes no
 * reportable data — logging in, or recording a forecast run — does not
 * throw the cache away.
 */
@Injectable()
export class CacheInvalidationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInvalidationInterceptor.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!MUTATING.has(request.method)) {
      return next.handle();
    }

    // Only on success: the handler throwing means nothing changed, and
    // clearing the cache then would just be wasted work.
    return next.handle().pipe(
      switchMap((data: unknown) =>
        from(
          this.cache.clear().catch((err: unknown) => {
            // A cache that will not clear must not fail the write that
            // already succeeded; the worst case is briefly stale reports.
            this.logger.error(
              `Failed to clear the response cache after ${request.method} ${request.url}`,
              errorText(err),
            );
          }),
        ).pipe(switchMap(() => from([data]))),
      ),
    );
  }
}
