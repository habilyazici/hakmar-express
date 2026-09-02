import { INestApplication } from '@nestjs/common';
import { agent, createTestApp } from './support/test-app';

/**
 * The two probes a deployment actually depends on.
 *
 * The single `/health` this replaced answered `{ status: 'ok' }` without
 * touching anything, while docker-compose used it both as the API's own
 * healthcheck and as the condition the web container waits on — so an API
 * whose Postgres was unreachable reported itself healthy and had traffic
 * routed to it.
 */
describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('answers without a token', async () => {
      const res = await agent(app).get('/api/v1/health').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
      expect(typeof res.body.data.timestamp).toBe('string');
    });

    /**
     * Liveness must not depend on anything but the process. A probe that
     * fails when the database does turns a database hiccup into a restart
     * loop, and restarting the API cannot fix Postgres.
     */
    it('is a liveness probe: it reports no dependencies at all', async () => {
      const res = await agent(app).get('/api/v1/health').expect(200);
      expect(res.body.data.checks).toBeUndefined();
    });
  });

  describe('GET /health/ready', () => {
    it('reports both dependencies as up when they are', async () => {
      const res = await agent(app).get('/api/v1/health/ready').expect(200);

      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.checks.database.status).toBe('up');
      expect(res.body.data.checks.cache.status).toBe('up');
    });

    it('needs no token either — a probe holds no credentials', async () => {
      await agent(app).get('/api/v1/health/ready').expect(200);
    });
  });

  /**
   * A probe polling every few seconds from one address is exactly the traffic
   * the per-IP limit exists to stop. An instance that rate-limits its own
   * health check reports itself down under load, which is when the answer
   * matters most.
   */
  it('never throttles a probe', async () => {
    for (let i = 0; i < 80; i++) {
      await agent(app).get('/api/v1/health').expect(200);
    }
  });

  /**
   * Every response carries the id its failures would be logged under, and an
   * inbound one is honoured so a proxy's trace survives this hop.
   */
  describe('request id', () => {
    it('assigns one to every response', async () => {
      const res = await agent(app).get('/api/v1/health').expect(200);
      expect(res.headers['x-request-id']).toMatch(/\S/);
    });

    it('keeps an inbound id rather than minting a competing one', async () => {
      const res = await agent(app)
        .get('/api/v1/health')
        .set('X-Request-Id', 'trace-abc-123')
        .expect(200);

      expect(res.headers['x-request-id']).toBe('trace-abc-123');
    });

    it('strips what a header must not carry into a log line', async () => {
      const res = await agent(app)
        .get('/api/v1/health')
        .set('X-Request-Id', 'abc  def')
        .expect(200);

      // A newline in a header is the whole of log injection; the id that
      // comes back is the sanitised one, not what was sent.
      expect(res.headers['x-request-id']).toBe('abcdef');
    });
  });
});
