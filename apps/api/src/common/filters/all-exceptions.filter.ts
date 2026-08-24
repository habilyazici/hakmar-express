import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../../generated/prisma/client';

interface ErrorShape {
  status: number;
  code: string;
  message: string;
}

/**
 * Maps the Prisma errors this app can actually produce onto sensible HTTP
 * responses. Without this they fell through to the generic branch below and
 * every one of them became an opaque 500 — a deleted-but-still-authenticated
 * user hitting /auth/profile (findUniqueOrThrow -> P2025) reported "Internal
 * server error" instead of 404, and once write endpoints land, a duplicate
 * username (P2002) would have done the same instead of 409.
 */
const PRISMA_ERROR_MAP: Record<string, { status: number; message: string }> = {
  P2000: {
    status: HttpStatus.BAD_REQUEST,
    message: 'A provided value is too long for its column.',
  },
  P2002: {
    status: HttpStatus.CONFLICT,
    message: 'A record with these unique values already exists.',
  },
  P2003: {
    status: HttpStatus.CONFLICT,
    message: 'Related record is missing or still referenced.',
  },
  P2025: {
    status: HttpStatus.NOT_FOUND,
    message: 'Record not found.',
  },
};

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
    const { status, code, message } = this.describe(exception);

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      error: { code, message },
    });
  }

  private describe(exception: unknown): ErrorShape {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        code: HttpStatus[status] ?? 'ERROR',
        message: this.extractMessage(exception),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = PRISMA_ERROR_MAP[exception.code];
      if (mapped) {
        return {
          status: mapped.status,
          code: HttpStatus[mapped.status] ?? 'ERROR',
          message: mapped.message,
        };
      }
      // Unmapped Prisma codes are genuine server-side faults; log them with
      // the code so the gap is visible rather than silently generic.
      this.logger.error(`Unmapped Prisma error ${exception.code}`);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    };
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
