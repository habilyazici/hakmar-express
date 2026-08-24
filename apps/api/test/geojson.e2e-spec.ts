import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { INestApplication } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../src/prisma/prisma.service';
import { agent, createTestApp } from './support/test-app';

const USERNAME = process.env.SEED_ADMIN_USERNAME ?? 'superadmin';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

interface Feature {
  type: string;
  properties: { name: string; number: number };
  geometry: { type: string; coordinates: unknown };
}

describe('GeoJSON (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cache: Cache;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    cache = app.get<Cache>(CACHE_MANAGER);

    const login = await agent(app)
      .post('/api/v1/auth/login')
      .send({ username: USERNAME, password: PASSWORD })
      .expect(200);
    accessToken = login.body.data.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves all 81 provinces from the seeded data', async () => {
    const res = await agent(app)
      .get('/api/v1/geo/geojson/city')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const payload = res.body.data as {
      dataType: string;
      version: number;
      data: { type: string; features: Feature[] };
    };

    expect(payload.dataType).toBe('city');
    expect(payload.data.type).toBe('FeatureCollection');
    expect(payload.data.features).toHaveLength(81);
  });

  /**
   * Plate code is the join key between the forecast and the boundaries. If
   * the set of codes in the file ever drifted from 1..81, provinces would
   * silently fall off the map with no error anywhere.
   */
  it('covers every plate code from 1 to 81 exactly once', async () => {
    const res = await agent(app)
      .get('/api/v1/geo/geojson/city')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const features = (res.body.data as { data: { features: Feature[] } }).data
      .features;
    const codes = features
      .map((f) => f.properties.number)
      .sort((a, b) => a - b);

    expect(new Set(codes).size).toBe(81);
    expect(codes[0]).toBe(1);
    expect(codes[80]).toBe(81);
  });

  it('gives every feature a name and a drawable geometry', async () => {
    const res = await agent(app)
      .get('/api/v1/geo/geojson/city')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const features = (res.body.data as { data: { features: Feature[] } }).data
      .features;
    for (const feature of features) {
      expect(typeof feature.properties.name).toBe('string');
      expect(feature.properties.name.length).toBeGreaterThan(0);
      expect(['Polygon', 'MultiPolygon']).toContain(feature.geometry.type);
      expect(Array.isArray(feature.geometry.coordinates)).toBe(true);
    }
  });

  it('includes a few known provinces at their real plate codes', async () => {
    const res = await agent(app)
      .get('/api/v1/geo/geojson/city')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const byCode = new Map(
      (res.body.data as { data: { features: Feature[] } }).data.features.map(
        (f) => [f.properties.number, f.properties.name],
      ),
    );

    expect(byCode.get(1)).toBe('Adana');
    expect(byCode.get(6)).toBe('Ankara');
    expect(byCode.get(34)).toBe('İstanbul');
    expect(byCode.get(35)).toBe('İzmir');
  });

  it('rejects an unknown geojson type with 400', async () => {
    const res = await agent(app)
      .get('/api/v1/geo/geojson/galaxy')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await agent(app).get('/api/v1/geo/geojson/city');
    expect(res.status).toBe(401);
  });

  it('answers 404 with a fixable message when nothing is loaded', async () => {
    const rows = await prisma.geoJsonData.findMany({
      where: { dataType: 'city' },
    });
    await prisma.geoJsonData.deleteMany({ where: { dataType: 'city' } });
    // The earlier assertions in this file populated the response cache, and
    // its TTL is a day — without clearing it this would keep serving the
    // boundaries that were just deleted.
    await cache.clear();

    try {
      const res = await agent(app)
        .get('/api/v1/geo/geojson/city')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
      // The message has to name the command that fixes it — an unseeded
      // table is an operator problem, not a bug to go hunting for.
      expect(res.body.error.message).toContain('prisma db seed');
    } finally {
      await cache.clear();
      for (const row of rows) {
        await prisma.geoJsonData.create({
          data: {
            dataType: row.dataType,
            data: row.data ?? {},
            version: row.version,
          },
        });
      }
    }
  });
});
