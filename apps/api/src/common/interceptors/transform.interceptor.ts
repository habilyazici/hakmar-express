import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: true;
  data: T;
}

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
