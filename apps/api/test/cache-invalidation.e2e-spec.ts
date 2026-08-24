import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { INestApplication } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { AuthController } from '../src/auth/auth.controller';
import { CategoriesController } from '../src/catalog/catalog.controller';
import { CacheInvalidationInterceptor } from '../src/common/interceptors/cache-invalidation.interceptor';
import { BranchesController } from '../src/geo/geo.controller';
import { CustomersController } from '../src/people/people.controller';
import { PrismaService } from '../src/prisma/prisma.service';
import { SpatialForecastController } from '../src/spatial-forecast/spatial-forecast.controller';
import { UsersController } from '../src/users/users.controller';
import { agent, clearCache, createTestApp } from './support/test-app';

const USERNAME = process.env.SEED_ADMIN_USERNAME ?? 'superadmin';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

/**
 * Analytics responses are cached for minutes at a time, which was harmless
 * until master data became editable through the API. Without invalidation a
 * branch created in the management screen is missing from every report until
 * its cache entry expires — indistinguishable, to whoever added it, from the
 * report being wrong.
 */
describe('Cache invalidation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cache: Cache;
  let token: string;

  let regionId = 0;
  let cityId = 0;
  const branchIds: number[] = [];

  /**
   * Asserts on this suite's own branch by name rather than on the total
   * count. The other e2e suites run in parallel and create and delete
   * branches of their own, so any assertion about how many exist is really
   * an assertion about what the rest of the suite happened to be doing.
   */
  async function rankingNames(): Promise<string[]> {
    const res = await agent(app)
      .get('/api/v1/tables/ranking')
      .query({ entity: 'branch', limit: 500 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return (res.body.data as { name: string }[]).map((r) => r.name);
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    cache = app.get<Cache>(CACHE_MANAGER);

    const login = await agent(app)
      .post('/api/v1/auth/login')
      .send({ username: USERNAME, password: PASSWORD })
      .expect(200);
    token = login.body.data.accessToken as string;

    const region = await prisma.region.create({ data: { name: 'CI Region' } });
    regionId = region.id;
    const city = await prisma.city.create({
      data: { name: 'CI City', plateCode: 994, regionId },
    });
    cityId = city.id;

    // Fixtures went in through Prisma, so nothing invalidated the response
    // cache; a stale analytics answer from another suite would otherwise
    // hide the rows just created.
    await clearCache(app);
  });

  afterAll(async () => {
    await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await prisma.region.deleteMany({ where: { id: regionId } });
    await app.close();
  });

  it('shows a newly created branch in the cached ranking straight away', async () => {
    // Populate the cache first, so the new branch can only appear if the
    // write actually invalidated it.
    await cache.clear();
    expect(await rankingNames()).not.toContain('CI Branch');

    const created = await agent(app)
      .post('/api/v1/geo/branches')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CI Branch', cityId })
      .expect(201);
    branchIds.push(created.body.data.id as number);

    expect(await rankingNames()).toContain('CI Branch');
  });

  it('drops a deleted branch from the cached ranking straight away', async () => {
    const id = branchIds.pop()!;
    expect(await rankingNames()).toContain('CI Branch');

    await agent(app)
      .delete(`/api/v1/geo/branches/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(await rankingNames()).not.toContain('CI Branch');
  });

  it('reflects a rename straight away', async () => {
    const created = await agent(app)
      .post('/api/v1/geo/branches')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CI Before Rename', cityId })
      .expect(201);
    const id = created.body.data.id as number;
    branchIds.push(id);

    // Populate the cache with the pre-rename name.
    const first = await agent(app)
      .get('/api/v1/tables/ranking')
      .query({ entity: 'branch', limit: 500 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      (first.body.data as { name: string }[]).some(
        (r) => r.name === 'CI Before Rename',
      ),
    ).toBe(true);

    await agent(app)
      .patch(`/api/v1/geo/branches/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CI After Rename' })
      .expect(200);

    const second = await agent(app)
      .get('/api/v1/tables/ranking')
      .query({ entity: 'branch', limit: 500 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const names = (second.body.data as { name: string }[]).map((r) => r.name);
    expect(names).toContain('CI After Rename');
    expect(names).not.toContain('CI Before Rename');
  });

  /**
   * The interceptor is deliberately per-controller rather than global: a POST
   * that changes nothing reportable should not throw the cache away.
   *
   * Asserted structurally rather than by watching the cache. Because the
   * interceptor clears everything, any test that checks a cache entry
   * survived is at the mercy of whichever other suite happens to write master
   * data at the same moment — the suites run in parallel. Which controllers
   * carry the interceptor is a fact about the wiring, and is deterministic.
   */
  describe('scope', () => {
    const interceptorsOf = (target: object): string[] =>
      (
        (Reflect.getMetadata('__interceptors__', target) as
          { name: string }[] | undefined) ?? []
      ).map((i) => i.name);

    it.each([
      ['CategoriesController', CategoriesController],
      ['BranchesController', BranchesController],
      ['CustomersController', CustomersController],
    ])('clears the cache after writes to %s', (_name, controller) => {
      expect(interceptorsOf(controller)).toContain(
        CacheInvalidationInterceptor.name,
      );
    });

    it.each([
      ['AuthController', AuthController],
      ['SpatialForecastController', SpatialForecastController],
      ['UsersController', UsersController],
    ])('leaves the cache alone for writes to %s', (_name, controller) => {
      expect(interceptorsOf(controller)).not.toContain(
        CacheInvalidationInterceptor.name,
      );
    });
  });
});
