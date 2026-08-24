import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { agent, createTestApp } from './support/test-app';

const USERNAME = process.env.SEED_ADMIN_USERNAME ?? 'superadmin';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

interface AreaRow {
  id: number;
  name: string;
  method: 'regression' | 'mean';
  rSquared: number | null;
  forecast: { quantity: number; sales: number; cost: number; profit: number };
  baseline: { quantity: number; sales: number; cost: number; profit: number };
  changePct: Record<string, number | null>;
}

describe('Spatial Forecast (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  let regionId: number;
  let cityId: number;
  let branchId: number;
  let categoryId: number;
  let subcategoryId: number;
  let brandCode: string;
  let productId: number;
  let customerId: number;
  let cashierId: number;
  let receiptIds: number[] = [];
  const runIds: number[] = [];

  /**
   * 24 consecutive months ending last month, with sales rising by a fixed
   * amount each month. A clean linear trend means the fitted model has a
   * known answer to be checked against rather than just "some number".
   */
  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const login = await agent(app)
      .post('/api/v1/auth/login')
      .send({ username: USERNAME, password: PASSWORD })
      .expect(200);
    accessToken = login.body.data.accessToken as string;

    const region = await prisma.region.create({ data: { name: 'SF Region' } });
    regionId = region.id;
    const city = await prisma.city.create({
      data: { name: 'SF City', plateCode: 996, regionId },
    });
    cityId = city.id;
    const branch = await prisma.branch.create({
      data: { name: 'SF Branch', cityId },
    });
    branchId = branch.id;
    const category = await prisma.category.create({ data: { name: 'SF Cat' } });
    categoryId = category.id;
    const subcategory = await prisma.subcategory.create({
      data: { name: 'SF Sub', categoryId },
    });
    subcategoryId = subcategory.id;
    const brand = await prisma.brand.create({
      data: { code: 'SFBR', name: 'SF Brand', categoryId },
    });
    brandCode = brand.code;
    const product = await prisma.product.create({
      data: { name: 'SF Product', brandCode, subcategoryId },
    });
    productId = product.id;
    const customer = await prisma.customer.create({
      data: { firstName: 'SF', lastName: 'Customer', gender: 'M' },
    });
    customerId = customer.id;
    const cashier = await prisma.cashier.create({
      data: { firstName: 'SF', lastName: 'Cashier', branchId },
    });
    cashierId = cashier.id;

    const receiptTime = new Date('1970-01-01T10:00:00Z');
    const ids: number[] = [];

    // monthsAgo 24 -> 1, so every row is strictly before today.
    for (let i = 0; i < 24; i++) {
      const monthsAgo = 24 - i;
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(15);
      date.setUTCMonth(date.getUTCMonth() - monthsAgo);

      const sales = 1000 + i * 100;
      const cost = 600 + i * 60;
      const receipt = await prisma.receipt.create({
        data: {
          branchId,
          cashierId,
          customerId,
          receiptDate: date,
          receiptTime,
        },
      });
      ids.push(receipt.id);
      await prisma.receiptItem.create({
        data: {
          receiptId: receipt.id,
          productId,
          quantity: 10 + i,
          totalPrice: sales,
          totalCost: cost,
          totalMargin: sales - cost,
        },
      });
    }
    receiptIds = ids;
  });

  afterAll(async () => {
    if (runIds.length > 0) {
      await prisma.spatialForecastRun.deleteMany({
        where: { id: { in: runIds } },
      });
    }
    await prisma.receiptItem.deleteMany({
      where: { receiptId: { in: receiptIds } },
    });
    await prisma.receipt.deleteMany({ where: { id: { in: receiptIds } } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.brand.delete({ where: { code: brandCode } });
    await prisma.subcategory.delete({ where: { id: subcategoryId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.cashier.delete({ where: { id: cashierId } });
    await prisma.customer.delete({ where: { id: customerId } });
    await prisma.branch.delete({ where: { id: branchId } });
    await prisma.city.delete({ where: { id: cityId } });
    await prisma.region.delete({ where: { id: regionId } });
    await app.close();
  });

  async function runForecast(body: Record<string, unknown>) {
    const res = await agent(app)
      .post('/api/v1/spatial-forecast/run')
      .send(body)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    const data = res.body.data as {
      runId: number;
      areas: AreaRow[];
      model: { discountShare: number; areasModeled: number };
      totals: { forecast: AreaRow['forecast'] };
    };
    runIds.push(data.runId);
    return data;
  }

  it('fits a regression for the seeded city and projects its rising trend', async () => {
    const data = await runForecast({ periodMonths: 6 });

    const ours = data.areas.find((a) => a.name === 'SF City');
    expect(ours).toBeDefined();
    expect(ours!.method).toBe('regression');
    // A perfectly linear series should be fitted almost exactly.
    expect(ours!.rSquared).toBeGreaterThan(0.99);

    // Last 6 actual months are i = 18..23 -> sales 2800..3300, total 18300.
    expect(ours!.baseline.sales).toBeCloseTo(18300, 2);

    // Extrapolating +100/month for 6 more months (i = 24..29) gives
    // 3400..3900 -> 21900. Allow room for the seasonal harmonics.
    expect(ours!.forecast.sales).toBeGreaterThan(20000);
    expect(ours!.forecast.sales).toBeLessThan(24000);
    expect(ours!.changePct.sales).toBeGreaterThan(0);
  });

  it('keeps profit equal to sales minus cost end to end', async () => {
    const data = await runForecast({ periodMonths: 6, discountPct: 10 });

    const ours = data.areas.find((a) => a.name === 'SF City')!;
    expect(ours.forecast.profit).toBeCloseTo(
      ours.forecast.sales - ours.forecast.cost,
      4,
    );
    expect(ours.forecast.profit).not.toBeCloseTo(ours.forecast.sales, 2);
  });

  it('raises forecast volume when a discount is simulated', async () => {
    const plain = await runForecast({ periodMonths: 6 });
    const discounted = await runForecast({ periodMonths: 6, discountPct: 20 });

    const a = plain.areas.find((x) => x.name === 'SF City')!;
    const b = discounted.areas.find((x) => x.name === 'SF City')!;

    expect(b.forecast.quantity).toBeGreaterThan(a.forecast.quantity);
    expect(b.forecast.cost).toBeGreaterThan(a.forecast.cost);
  });

  it('reduces profit when a cost shock is simulated', async () => {
    const plain = await runForecast({ periodMonths: 6 });
    const shocked = await runForecast({ periodMonths: 6, costChangePct: 40 });

    const a = plain.areas.find((x) => x.name === 'SF City')!;
    const b = shocked.areas.find((x) => x.name === 'SF City')!;

    expect(b.forecast.cost).toBeCloseTo(a.forecast.cost * 1.4, 2);
    expect(b.forecast.profit).toBeLessThan(a.forecast.profit);
    expect(b.forecast.sales).toBeCloseTo(a.forecast.sales, 2);
  });

  it('computes a real revenue share for a category-scoped discount', async () => {
    const data = await runForecast({
      periodMonths: 6,
      discountPct: 10,
      discountScope: 'category',
      discountTargetId: categoryId,
    });

    // The seeded category is one of possibly several in the table, so the
    // share must be a genuine fraction in (0, 1], never a hardcoded constant.
    expect(data.model.discountShare).toBeGreaterThan(0);
    expect(data.model.discountShare).toBeLessThanOrEqual(1);
  });

  it('aggregates to regions when asked', async () => {
    const data = await runForecast({ mapType: 'region', periodMonths: 6 });

    const ours = data.areas.find((a) => a.name === 'SF Region');
    expect(ours).toBeDefined();
    expect(ours!.baseline.sales).toBeCloseTo(18300, 2);
  });

  it('records each run and can read one back in full', async () => {
    const data = await runForecast({ periodMonths: 3 });

    const list = await agent(app)
      .get('/api/v1/spatial-forecast/runs')
      .query({ limit: 50 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = list.body.data as { id: number; periodMonths: number }[];
    const saved = rows.find((r) => r.id === data.runId);
    expect(saved).toBeDefined();
    expect(saved!.periodMonths).toBe(3);
    // The listing must not carry the full per-area payload.
    expect(saved).not.toHaveProperty('resultJson');

    const detail = await agent(app)
      .get(`/api/v1/spatial-forecast/runs/${data.runId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(detail.body.data.resultJson.areas.length).toBeGreaterThan(0);
  });

  it('returns 404 for a run that does not exist', async () => {
    const res = await agent(app)
      .get('/api/v1/spatial-forecast/runs/99999999')
      .set('Authorization', `Bearer ${accessToken}`);
    // Prisma's P2025 is mapped to a 404 rather than leaking a 500.
    expect(res.status).toBe(404);
  });

  it('rejects a category-scoped discount with no target', async () => {
    const res = await agent(app)
      .post('/api/v1/spatial-forecast/run')
      .send({ discountPct: 10, discountScope: 'category' })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it('rejects an out-of-range horizon and an unknown map type', async () => {
    for (const body of [{ periodMonths: 999 }, { mapType: 'galaxy' }]) {
      const res = await agent(app)
        .post('/api/v1/spatial-forecast/run')
        .send(body)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(400);
    }
  });

  it('requires authentication', async () => {
    const res = await agent(app).post('/api/v1/spatial-forecast/run').send({});
    expect(res.status).toBe(401);
  });
});
