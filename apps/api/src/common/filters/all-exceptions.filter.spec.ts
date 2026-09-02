import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import type { ApiErrorEnvelope } from '@hakmar/contracts';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface CapturedResponse {
  status: number;
  body: ApiErrorEnvelope;
}

function runFilter(exception: unknown, requestId?: string): CapturedResponse {
  const captured = {} as CapturedResponse;
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: CapturedResponse['body']) {
      captured.body = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ requestId }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);
  return captured;
}

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: 'test',
  });
}

describe('AllExceptionsFilter', () => {
  beforeAll(() => {
    // The filter deliberately logs 5xx stacks; silence them so a passing run
    // isn't buried in expected error output.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('preserves the status and message of an HttpException', () => {
    const res = runFilter(new BadRequestException('metrics must be valid'));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'metrics must be valid' },
    });
  });

  it('joins class-validator message arrays into one string', () => {
    const res = runFilter(
      new BadRequestException(['a must be int', 'b required']),
    );

    expect(res.body.error.message).toBe('a must be int, b required');
  });

  it('keeps 404s from NotFoundException', () => {
    expect(runFilter(new NotFoundException('nope')).status).toBe(404);
  });

  // Before these were mapped, every Prisma error fell through to the generic
  // branch and became an opaque 500.
  it.each([
    ['P2025', 404, 'NOT_FOUND'],
    ['P2002', 409, 'CONFLICT'],
    ['P2003', 409, 'CONFLICT'],
    ['P2000', 400, 'BAD_REQUEST'],
  ])('maps Prisma %s to HTTP %i', (code, status, errorCode) => {
    const res = runFilter(prismaError(code));

    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(errorCode);
    expect(res.body.success).toBe(false);
  });

  it('still reports an unmapped Prisma code as a 500', () => {
    const res = runFilter(prismaError('P2034'));

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('never leaks an unknown error message to the client', () => {
    const res = runFilter(
      new Error('connection string user=admin password=hunter2'),
    );

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Internal server error');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });

  /**
   * A 500 says nothing useful by design, which leaves a user with nothing to
   * report. The request id is the handle that ties what they saw to the
   * stack trace the same request wrote to the log.
   */
  it('returns the request id on a server fault so it can be quoted', () => {
    const res = runFilter(new Error('boom'), 'req-123');

    expect(res.status).toBe(500);
    expect(res.body.error.requestId).toBe('req-123');
  });

  it('does not attach a request id to a client error', () => {
    const res = runFilter(new BadRequestException('nope'), 'req-123');

    expect(res.status).toBe(400);
    expect(res.body.error.requestId).toBeUndefined();
  });
});
