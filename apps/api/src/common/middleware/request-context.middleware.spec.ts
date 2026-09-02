import { Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import type { NextFunction, Request, Response } from 'express';
import { RequestContextMiddleware } from './request-context.middleware';

/**
 * The logging half of this is easy to get subtly wrong and impossible to
 * notice: a probe path that stops matching just means the log fills with
 * nine thousand lines a day, which nobody reads and no test would fail on.
 * It happened once already — `req.path` is relative to wherever Nest mounts
 * the middleware, so it never matched the probe paths at all.
 */
describe('RequestContextMiddleware', () => {
  let middleware: RequestContextMiddleware;
  let logged: { level: string; message: string }[];

  function fakeRequest(
    originalUrl: string,
    headers: Record<string, string | string[]> = {},
  ): Request {
    return { method: 'GET', originalUrl, headers } as unknown as Request;
  }

  /** An EventEmitter is what a real response is; 'finish' is the real event. */
  function fakeResponse(statusCode: number) {
    const headers: Record<string, string> = {};
    const emitter = new EventEmitter();
    const res = Object.assign(emitter, {
      statusCode,
      headers,
      setHeader(name: string, value: string) {
        headers[name] = value;
        return res;
      },
    });
    return res as typeof res & Response;
  }

  function run(req: Request, statusCode: number) {
    const res = fakeResponse(statusCode);
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    res.emit('finish');
    return res;
  }

  beforeEach(() => {
    middleware = new RequestContextMiddleware();
    logged = [];
    // Nest's Logger methods are variadic, so the mock has to be too — this
    // asserts on the first argument, which is the whole line.
    for (const level of ['log', 'warn', 'error'] as const) {
      jest
        .spyOn(Logger.prototype, level)
        .mockImplementation((...args: unknown[]) => {
          logged.push({ level, message: String(args[0]) });
        });
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('the request id', () => {
    it('mints one and puts it on both the request and the response', () => {
      const req = fakeRequest('/api/v1/dashboard/summary');
      const res = run(req, 200);

      expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.headers['x-request-id']).toBe(req.requestId);
    });

    it("keeps a caller's own id rather than minting a competing one", () => {
      const req = fakeRequest('/api/v1/dashboard/summary', {
        'x-request-id': 'trace-abc-123',
      });
      run(req, 200);

      expect(req.requestId).toBe('trace-abc-123');
    });

    /** A newline in a header is the whole of log injection. */
    it('strips what a header must not carry into a log line', () => {
      const req = fakeRequest('/api/v1/x', {
        'x-request-id': 'abc\n[Nest] LOG forged line',
      });
      run(req, 200);

      expect(req.requestId).not.toContain('\n');
      expect(req.requestId).toBe('abcNestLOGforgedline');
    });

    it('bounds an absurdly long one', () => {
      const req = fakeRequest('/api/v1/x', { 'x-request-id': 'a'.repeat(500) });
      run(req, 200);

      expect(req.requestId).toHaveLength(128);
    });

    it('mints one when the inbound header is empty after sanitising', () => {
      const req = fakeRequest('/api/v1/x', { 'x-request-id': '!!!!' });
      run(req, 200);

      expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('the log line', () => {
    it('records method, url, status and duration', () => {
      run(fakeRequest('/api/v1/charts/trend?granularity=month'), 200);

      expect(logged).toHaveLength(1);
      expect(logged[0].level).toBe('log');
      expect(logged[0].message).toMatch(
        /^GET \/api\/v1\/charts\/trend\?granularity=month 200 [\d.]+ms \[[\w-]+\]$/,
      );
    });

    it.each([
      [200, 'log'],
      [404, 'warn'],
      [429, 'warn'],
      [500, 'error'],
    ])('logs a %i at the %s level', (status, level) => {
      run(fakeRequest('/api/v1/x'), status);
      expect(logged[0].level).toBe(level);
    });

    it('logs once even when a response both closes and finishes', () => {
      const res = fakeResponse(200);
      middleware.use(fakeRequest('/api/v1/x'), res, jest.fn());

      res.emit('finish');
      res.emit('close');

      expect(logged).toHaveLength(1);
    });

    it('logs a client that hung up before the response finished', () => {
      const res = fakeResponse(200);
      middleware.use(fakeRequest('/api/v1/x'), res, jest.fn());

      res.emit('close');

      expect(logged).toHaveLength(1);
    });
  });

  /**
   * The container healthcheck polls every ten seconds, forever. These four
   * are the difference between a log worth reading and nine thousand lines a
   * day of nothing.
   */
  describe('health probes', () => {
    it.each(['/api/v1/health', '/api/v1/health/ready'])(
      'says nothing about a passing %s',
      (path) => {
        run(fakeRequest(path), 200);
        expect(logged).toHaveLength(0);
      },
    );

    it('still gives a passing probe a request id', () => {
      const req = fakeRequest('/api/v1/health');
      run(req, 200);

      expect(req.requestId).toMatch(/\S/);
    });

    it('does log a probe that starts failing', () => {
      run(fakeRequest('/api/v1/health/ready'), 503);

      expect(logged).toHaveLength(1);
      expect(logged[0].level).toBe('error');
    });

    /** Quiet is the exact path, not a prefix — /health-check is not a probe. */
    it('does not silence a route that merely starts the same way', () => {
      run(fakeRequest('/api/v1/health-check'), 200);
      expect(logged).toHaveLength(1);
    });
  });
});
