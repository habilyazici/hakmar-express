import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Registered globally (APP_FILTER). Every error response is shaped the same
 * way: { success: false, error: { code, message } }. The legacy app mixed
 * `error` and `message` fields inconsistently across controllers, forcing
 * defensive `err.message || err.error` handling on the frontend.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? this.extractMessage(exception)
        : 'Internal server error';

    const code =
      exception instanceof HttpException
        ? (HttpStatus[status] ?? 'ERROR')
        : 'INTERNAL_SERVER_ERROR';

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    }

    response.status(status).json({
      success: false,
      error: { code, message },
    });
  }

  private extractMessage(exception: HttpException): string {
    const res = exception.getResponse();
    if (typeof res === 'string') return res;
    if (typeof res === 'object' && res !== null && 'message' in res) {
      const m = (res as Record<string, unknown>).message;
      return Array.isArray(m) ? m.join(', ') : String(m);
    }
    return exception.message;
  }
}
