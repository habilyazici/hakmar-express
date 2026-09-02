import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * `requestId` on the Express request. A module augmentation rather than a
 * parameter threaded through, because everything that needs it — the
 * exception filter, and any handler that wants to log — already holds the
 * request object it hangs off.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Paths that are polled rather than used.
 *
 * The container healthcheck hits /health/ready every ten seconds, forever,
 * and a load balancer in front adds its own. Logging those is nine thousand
 * lines a day saying nothing, which is worse than not logging them: it is the
 * volume that makes the real lines hard to find.
 *
 * Only their *successful* responses are quiet. A probe that starts failing is
 * the single most interesting line in the file, and it still gets one — see
 * the status check below. Every request gets an id either way.
 */
const QUIET_PATHS = ['/api/v1/health', '/api/v1/health/ready'];

/**
 * The request's path, taken from `originalUrl` rather than `req.path`.
 *
 * Nest mounts middleware through its own router, and `req.path` is relative
 * to wherever that mount ended up — so it did not match the paths above and
 * every health probe was logged after all. `originalUrl` is the one field
 * that always holds what the client actually asked for, query string
 * included, which is why the log line below uses it too.
 */
function pathOf(req: Request): string {
  const url = req.originalUrl;
  const query = url.indexOf('?');
  return query === -1 ? url : url.slice(0, query);
}

/**
 * A request id on every request, and one log line per completed request.
 *
 * There was nothing here before: no access log, no timings, no way to tie a
 * 500 in the logs to the request that caused it. That is survivable in
 * development, where the failing request is the one you just made, and not in
 * a deployment, where "the dashboard was slow this morning" has to be
 * answerable from what the process wrote down.
 *
 * The id is taken from an inbound X-Request-Id when there is one, so a proxy
 * or a caller that already traces requests keeps its own id across this hop
 * rather than the two disagreeing. It is echoed back on the response, and the
 * exception filter puts it in the body of a 5xx, so a user reporting a
 * failure can quote something that finds the stack trace.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = readInboundId(req) ?? randomUUID();
    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const isQuiet = QUIET_PATHS.includes(pathOf(req));
    const startedAt = process.hrtime.bigint();

    // 'finish' fires once the response is fully written, which is what makes
    // the duration meaningful and the status code final. 'close' covers the
    // client hanging up first, which would otherwise log nothing at all.
    let logged = false;
    const log = () => {
      if (logged) return;
      logged = true;
      // A healthy probe says nothing worth a line; a failing one says the
      // most important thing this file can contain.
      if (isQuiet && res.statusCode < 400) return;
      const ms = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms [${requestId}]`;
      // Server faults are already logged with their stack by the exception
      // filter; this is the line that says which request produced it.
      if (res.statusCode >= 500) this.logger.error(line);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    };

    res.on('finish', log);
    res.on('close', log);

    next();
  }
}

/**
 * An inbound id is used as-is, but only if it looks like an id.
 *
 * It reaches a log file, so anything is accepted only after it has been
 * bounded and stripped of the characters that would let a caller forge a
 * second log line — a newline in a header is the whole of log injection.
 */
function readInboundId(req: Request): string | null {
  const raw = req.headers[REQUEST_ID_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const safe = value
    .trim()
    .slice(0, 128)
    .replace(/[^\w.:@-]/g, '');
  return safe.length > 0 ? safe : null;
}
