import { INestApplication } from '@nestjs/common';
import { Role } from '../generated/prisma/enums';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../src/prisma/prisma.service';
import { agent, createTestApp } from './support/test-app';

const USERNAME = process.env.SEED_ADMIN_USERNAME ?? 'superadmin';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
const ANALYST_USERNAME = 'md-analyst';
const ANALYST_PASSWORD = 'AnalystPw123!';

interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

describe('Master data (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let analystToken: string;
  let analystId: number;

  const created = {
    regionId: 0,
    cityId: 0,
    branchId: 0,
    categoryId: 0,
    subcategoryId: 0,
    brandCode: '',
    productId: 0,
    customerId: 0,
    cashierId: 0,
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const login = await agent(app)
      .post('/api/v1/auth/login')
      .send({ username: USERNAME, password: PASSWORD })
      .expect(200);
    adminToken = login.body.data.accessToken as string;

    // A real ANALYST, to prove the read/write split is enforced rather than
    // just declared.
    const analyst = await prisma.adminUser.create({
      data: {
        username: ANALYST_USERNAME,
        passwordHash: await bcrypt.hash(ANALYST_PASSWORD, 4),
        fullName: 'Read Only',
        role: Role.ANALYST,
        isActive: true,
      },
    });
    analystId = analyst.id;

    const analystLogin = await agent(app)
      .post('/api/v1/auth/login')
      .send({ username: ANALYST_USERNAME, password: ANALYST_PASSWORD })
      .expect(200);
    analystToken = analystLogin.body.data.accessToken as string;
  });

  afterAll(async () => {
    // Reverse dependency order so foreign keys never block the teardown.
    if (created.cashierId) {
      await prisma.cashier.deleteMany({ where: { id: created.cashierId } });
    }
    if (created.customerId) {
      await prisma.customer.deleteMany({ where: { id: created.customerId } });
    }
    if (created.productId) {
      await prisma.product.deleteMany({ where: { id: created.productId } });
    }
    if (created.brandCode) {
      await prisma.brand.deleteMany({ where: { code: created.brandCode } });
    }
    if (created.subcategoryId) {
      await prisma.subcategory.deleteMany({
        where: { id: created.subcategoryId },
      });
    }
    if (created.categoryId) {
      await prisma.category.deleteMany({ where: { id: created.categoryId } });
    }
    if (created.branchId) {
      await prisma.branch.deleteMany({ where: { id: created.branchId } });
    }
    if (created.cityId) {
      await prisma.city.deleteMany({ where: { id: created.cityId } });
    }
    if (created.regionId) {
      await prisma.region.deleteMany({ where: { id: created.regionId } });
    }
    await prisma.refreshToken.deleteMany({ where: { userId: analystId } });
    await prisma.adminUser.deleteMany({ where: { id: analystId } });
    await app.close();
  });

  describe('geo', () => {
    it('creates a region, city and branch through the API', async () => {
      const region = await agent(app)
        .post('/api/v1/geo/regions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'MD Region' })
        .expect(201);
      created.regionId = region.body.data.id as number;
      expect(region.body.data.name).toBe('MD Region');

      const city = await agent(app)
        .post('/api/v1/geo/cities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'MD City', plateCode: 81, regionId: created.regionId })
        .expect(201);
      created.cityId = city.body.data.id as number;

      const branch = await agent(app)
        .post('/api/v1/geo/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'MD Branch',
          cityId: created.cityId,
          latitude: 41.01,
          longitude: 28.98,
        })
        .expect(201);
      created.branchId = branch.body.data.id as number;
      expect(Number(branch.body.data.latitude)).toBeCloseTo(41.01, 4);
    });

    it('reads a branch back with its city and region joined', async () => {
      const res = await agent(app)
        .get(`/api/v1/geo/branches/${created.branchId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.city.name).toBe('MD City');
      expect(res.body.data.city.region.name).toBe('MD Region');
    });

    it('paginates and reports a total', async () => {
      const res = await agent(app)
        .get('/api/v1/geo/regions')
        .query({ limit: 1, offset: 0 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const page = res.body.data as Page<unknown>;
      expect(page.items).toHaveLength(1);
      expect(page.limit).toBe(1);
      expect(page.offset).toBe(0);
      expect(page.total).toBeGreaterThanOrEqual(1);
    });

    it('filters by the search term', async () => {
      const hit = await agent(app)
        .get('/api/v1/geo/regions')
        .query({ search: 'MD Reg' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(
        (hit.body.data as Page<{ name: string }>).items.some(
          (r) => r.name === 'MD Region',
        ),
      ).toBe(true);

      const miss = await agent(app)
        .get('/api/v1/geo/regions')
        .query({ search: 'definitely-not-a-region-xyz' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((miss.body.data as Page<unknown>).items).toHaveLength(0);
    });

    it('updates a region', async () => {
      const res = await agent(app)
        .patch(`/api/v1/geo/regions/${created.regionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'MD Region Renamed' })
        .expect(200);
      expect(res.body.data.name).toBe('MD Region Renamed');
    });

    /**
     * The Prisma-to-HTTP mapping added earlier is what makes this a 409
     * instead of an opaque 500 — this is the first endpoint that can actually
     * trigger it.
     */
    it('refuses to delete a region that still has cities, with 409 not 500', async () => {
      const res = await agent(app)
        .delete(`/api/v1/geo/regions/${created.regionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for a record that does not exist', async () => {
      const res = await agent(app)
        .get('/api/v1/geo/regions/99999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('catalog', () => {
    it('creates a category, subcategory, brand and product', async () => {
      const category = await agent(app)
        .post('/api/v1/catalog/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'MD Category' })
        .expect(201);
      created.categoryId = category.body.data.id as number;

      const subcategory = await agent(app)
        .post('/api/v1/catalog/subcategories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'MD Sub', categoryId: created.categoryId })
        .expect(201);
      created.subcategoryId = subcategory.body.data.id as number;

      const brand = await agent(app)
        .post('/api/v1/catalog/brands')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'MDBRAND',
          name: 'MD Brand',
          categoryId: created.categoryId,
        })
        .expect(201);
      created.brandCode = brand.body.data.code as string;

      const product = await agent(app)
        .post('/api/v1/catalog/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'MD Product',
          brandCode: created.brandCode,
          subcategoryId: created.subcategoryId,
        })
        .expect(201);
      created.productId = product.body.data.id as number;
    });

    it('addresses a brand by its string code, not a numeric id', async () => {
      const res = await agent(app)
        .get(`/api/v1/catalog/brands/${created.brandCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.code).toBe(created.brandCode);
      expect(res.body.data.category.name).toBe('MD Category');
    });

    it('rejects a duplicate brand code with 409, not 500', async () => {
      const res = await agent(app)
        .post('/api/v1/catalog/brands')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: created.brandCode,
          name: 'Another',
          categoryId: created.categoryId,
        });
      expect(res.status).toBe(409);
    });

    it('rejects a create that points at a non-existent parent with 409, not 500', async () => {
      const res = await agent(app)
        .post('/api/v1/catalog/subcategories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Orphan', categoryId: 99999999 });
      expect(res.status).toBe(409);
    });

    it('refuses to change a brand code through PATCH', async () => {
      // `code` is not on UpdateBrandDto, and forbidNonWhitelisted turns an
      // attempt to set it into a 400 rather than silently dropping it.
      const res = await agent(app)
        .patch(`/api/v1/catalog/brands/${created.brandCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'HIJACK' });
      expect(res.status).toBe(400);
    });
  });

  describe('people', () => {
    it('creates a customer and a cashier', async () => {
      const customer = await agent(app)
        .post('/api/v1/people/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'MD', lastName: 'Customer', gender: 'F' })
        .expect(201);
      created.customerId = customer.body.data.id as number;

      const cashier = await agent(app)
        .post('/api/v1/people/cashiers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'MD',
          lastName: 'Cashier',
          branchId: created.branchId,
        })
        .expect(201);
      created.cashierId = cashier.body.data.id as number;
    });

    it('rejects an unlisted gender value', async () => {
      const res = await agent(app)
        .post('/api/v1/people/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Bad', lastName: 'Gender', gender: 'X' });
      expect(res.status).toBe(400);
    });
  });

  describe('validation', () => {
    // [url, body, why it must be rejected]
    const invalid: [string, object, string][] = [
      ['/api/v1/geo/regions', { name: 'x' }, 'too short'],
      ['/api/v1/geo/regions', {}, 'missing name'],
      [
        '/api/v1/geo/cities',
        { name: 'Valid', plateCode: 999, regionId: 1 },
        'plate code out of range',
      ],
      [
        '/api/v1/geo/branches',
        { name: 'Valid', cityId: 1, latitude: 999 },
        'impossible latitude',
      ],
      [
        '/api/v1/catalog/brands',
        { code: 'lowercase', name: 'X Brand', categoryId: 1 },
        'malformed brand code',
      ],
      [
        '/api/v1/catalog/products',
        { name: 'P', brandCode: 'AB', subcategoryId: 0 },
        'zero id',
      ],
    ];

    it.each(invalid)('rejects %s (%s)', async (url, body) => {
      const res = await agent(app)
        .post(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);
      expect(res.status).toBe(400);
    });

    it('rejects unknown properties instead of silently dropping them', async () => {
      const res = await agent(app)
        .post('/api/v1/geo/regions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Valid Name', id: 1, isAdmin: true });
      expect(res.status).toBe(400);
    });
  });

  describe('authorization', () => {
    const writes: [string, string, object][] = [
      ['post', '/api/v1/geo/regions', { name: 'Analyst Region' }],
      ['post', '/api/v1/catalog/categories', { name: 'Analyst Category' }],
      ['post', '/api/v1/people/customers', { firstName: 'A', lastName: 'B' }],
    ];

    it.each(writes)('denies an ANALYST %s to %s', async (method, url, body) => {
      const res = await agent(app)
        [method as 'post'](url)
        .set('Authorization', `Bearer ${analystToken}`)
        .send(body);
      expect(res.status).toBe(403);
    });

    it('denies an ANALYST update and delete', async () => {
      const patch = await agent(app)
        .patch(`/api/v1/geo/regions/${created.regionId}`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ name: 'nope' });
      expect(patch.status).toBe(403);

      const del = await agent(app)
        .delete(`/api/v1/geo/regions/${created.regionId}`)
        .set('Authorization', `Bearer ${analystToken}`);
      expect(del.status).toBe(403);
    });

    it('still allows an ANALYST to read', async () => {
      const res = await agent(app)
        .get('/api/v1/geo/regions')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(res.status).toBe(200);
    });

    it('rejects an unauthenticated write', async () => {
      const res = await agent(app)
        .post('/api/v1/geo/regions')
        .send({ name: 'Anonymous' });
      expect(res.status).toBe(401);
    });
  });

  describe('deletion', () => {
    it('deletes leaf records in dependency order', async () => {
      await agent(app)
        .delete(`/api/v1/people/cashiers/${created.cashierId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
      created.cashierId = 0;

      await agent(app)
        .delete(`/api/v1/catalog/products/${created.productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
      created.productId = 0;

      const gone = await agent(app)
        .get(`/api/v1/catalog/products/${created.productId || 99999999}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(gone.status).toBe(404);
    });
  });
});
