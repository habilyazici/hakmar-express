import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { ApiEnvelope } from '@hakmar/contracts';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Re-exported so the wire shape has exactly one definition, in the
 *  package the web reads it from too. */
export type ApiResponse<T> = ApiEnvelope<T>;

/**
 * Registered globally (APP_INTERCEPTOR). Every successful response is
 * wrapped in the same { success, data } envelope. The legacy app had no
 * such guarantee — every controller shaped its own response, some nesting
 * data.data, some skipping the envelope entirely.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      // Response payload shape is genuinely unknown at this layer — every
      // handler returns something different. That's what T is for.

      map((data: T) => ({ success: true as const, data })),
    );
  }
}
