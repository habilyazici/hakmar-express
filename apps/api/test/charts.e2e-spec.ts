import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { agent, createTestApp } from './support/test-app';

const USERNAME = process.env.SEED_ADMIN_USERNAME ?? 'superadmin';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

/**
 * Seeds one small, fully-known data graph and asserts the raw-SQL trend and
 * ranking queries produce the exact expected numbers — not just "didn't
 * throw". This is what actually proves the whitelisted-dimension SQL joins
 * in ChartsService are correct against real Postgres.
 */
describe('Charts (e2e)', () => {
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
  let priceId: number;
  let costId: number;
  let customerId: number;
  let cashierId: number;
  let receiptIds: number[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const login = await agent(app)
      .post('/api/v1/auth/login')
      .send({ username: USERNAME, password: PASSWORD })
      .expect(200);
    accessToken = login.body.data.accessToken as string;

    const region = await prisma.region.create({ data: { name: 'E2E Region' } });
    regionId = region.id;
    const city = await prisma.city.create({
      data: { name: 'E2E City', plateCode: 999, regionId },
    });
    cityId = city.id;
    const branch = await prisma.branch.create({
      data: { name: 'E2E Branch', cityId, latitude: 40.98, longitude: 29.03 },
    });
    branchId = branch.id;
    const category = await prisma.category.create({
      data: { name: 'E2E Category' },
    });
    categoryId = category.id;
    const subcategory = await prisma.subcategory.create({
      data: { name: 'E2E Subcategory', categoryId },
    });
    subcategoryId = subcategory.id;
    const brand = await prisma.brand.create({
      data: { code: 'E2EBR', name: 'E2E Brand', categoryId },
    });
    brandCode = brand.code;
    const product = await prisma.product.create({
      data: { name: 'E2E Product', brandCode, subcategoryId },
    });
    productId = product.id;
    const price = await prisma.productPrice.create({
      data: { productId, year: 2026, unitPrice: 100 },
    });
    priceId = price.id;
    const cost = await prisma.productCost.create({
      data: { productId, regionId, year: 2026, unitCost: 60 },
    });
    costId = cost.id;
    const customer = await prisma.customer.create({
      data: { firstName: 'E2E', lastName: 'Customer', gender: 'F' },
    });
    customerId = customer.id;
    const cashier = await prisma.cashier.create({
      data: { firstName: 'E2E', lastName: 'Cashier', branchId },
    });
    cashierId = cashier.id;

    // Receipt 1: 2999-01-01, qty 2 @ price 100 -> sales 200, cost 120, margin 80
    const receipt1 = await prisma.receipt.create({
      data: {
        branchId,
        cashierId,
        customerId,
        receiptDate: new Date('2999-01-01'),
        receiptTime: new Date('1970-01-01T10:00:00Z'),
      },
    });
    await prisma.receiptItem.create({
      data: {
        receiptId: receipt1.id,
        productId,
        quantity: 2,
        priceId,
        costId,
        totalPrice: 200,
        totalCost: 120,
        totalMargin: 80,
      },
    });

    // Receipt 2: 2999-01-02, qty 3 @ price 100 -> sales 300, cost 180, margin 120
    const receipt2 = await prisma.receipt.create({
      data: {
        branchId,
        cashierId,
        customerId,
        receiptDate: new Date('2999-01-02'),
        receiptTime: new Date('1970-01-01T14:00:00Z'),
      },
    });
    await prisma.receiptItem.create({
      data: {
        receiptId: receipt2.id,
        productId,
        quantity: 3,
        priceId,
        costId,
        totalPrice: 300,
        totalCost: 180,
        totalMargin: 120,
      },
    });

    receiptIds = [receipt1.id, receipt2.id];
  });

  afterAll(async () => {
    await prisma.receiptItem.deleteMany({
      where: { receiptId: { in: receiptIds } },
    });
    await prisma.receipt.deleteMany({ where: { id: { in: receiptIds } } });
    await prisma.productCost.delete({ where: { id: costId } });
    await prisma.productPrice.delete({ where: { id: priceId } });
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

  it('computes exact daily sales/profit totals via /charts/trend', async () => {
    const res = await agent(app)
      .get('/api/v1/charts/trend')
      .query({ granularity: 'day', metrics: 'sales,profit' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = (
      res.body.data as { period: string; sales: string; profit: string }[]
    ).filter(
      (r) =>
        r.period.startsWith('2999-01-01') || r.period.startsWith('2999-01-02'),
    );

    expect(rows).toHaveLength(2);
    const jan1 = rows.find((r) => r.period.startsWith('2999-01-01'))!;
    const jan2 = rows.find((r) => r.period.startsWith('2999-01-02'))!;
    expect(Number(jan1.sales)).toBe(200);
    expect(Number(jan1.profit)).toBe(80);
    expect(Number(jan2.sales)).toBe(300);
    expect(Number(jan2.profit)).toBe(120);
  });

  it('serializes the orders metric (COUNT-backed, ::int cast) without 500ing', async () => {
    const res = await agent(app)
      .get('/api/v1/charts/trend')
      .query({ granularity: 'day', metrics: 'orders' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as { period: string; orders: number }[];
    const jan1 = rows.find((r) => r.period.startsWith('2999-01-01'));
    expect(jan1).toBeDefined();
    expect(jan1!.orders).toBe(1);
  });

  it('applies cumulative correctly on top of the same data', async () => {
    const res = await agent(app)
      .get('/api/v1/charts/trend')
      .query({ granularity: 'day', metrics: 'sales', cumulative: 'true' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as { period: string; sales: number }[];
    const jan2Index = rows.findIndex((r) => r.period.startsWith('2999-01-02'));
    const jan1Index = rows.findIndex((r) => r.period.startsWith('2999-01-01'));
    // cumulative sum by jan 2 must be >= the sum of just these two known
    // receipts (200 + 300), regardless of whatever else is in the table.
    expect(rows[jan2Index].sales).toBeGreaterThanOrEqual(500);
    expect(rows[jan2Index].sales).toBeGreaterThan(rows[jan1Index].sales);
  });

  it('ranks our seeded branch with the exact combined sales total', async () => {
    const res = await agent(app)
      .get('/api/v1/charts/ranking')
      .query({ dimension: 'branch', metric: 'sales', limit: 50 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as { id: number; name: string; value: string }[];
    const ours = rows.find((r) => r.name === 'E2E Branch');
    expect(ours).toBeDefined();
    expect(Number(ours!.value)).toBe(500);
  });

  it('rejects an invalid metric before touching the database', async () => {
    const res = await agent(app)
      .get('/api/v1/charts/trend')
      .query({ granularity: 'month', metrics: 'sales,DROP TABLE receipts' })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('accepts metrics sent as repeated query keys, not just CSV', async () => {
    // axios's default array serialization for `params: { metrics: [...] }`
    // sends ?metrics=sales&metrics=profit (a real array once Express/qs
    // parses it), not the CSV string our own frontend happens to send.
    const res = await agent(app)
      .get('/api/v1/charts/trend')
      .query({ granularity: 'day', metrics: ['sales', 'profit'] })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const rows = res.body.data as {
      period: string;
      sales: string;
      profit: string;
    }[];
    const jan1 = rows.find((r) => r.period.startsWith('2999-01-01'));
    expect(jan1).toBeDefined();
    expect(Number(jan1!.sales)).toBe(200);
    expect(Number(jan1!.profit)).toBe(80);
  });

  it('buckets sales by weekday x hour (2999-01-01 is a Tuesday, 2999-01-02 a Wednesday)', async () => {
    const res = await agent(app)
      .get('/api/v1/charts/heatmap')
      .query({ type: 'weekday-hour', metric: 'sales' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as { x: number; y: number; value: string }[];
    // This heatmap keys purely on weekday+hour, so unlike the date-keyed
    // assertions elsewhere in this file it cannot be isolated from other rows
    // in the table — any Tuesday 10:00 receipt lands in the same bucket.
    // Assert our contribution is included rather than that it is alone.
    const tuesday10am = rows.find((r) => r.x === 2 && r.y === 10);
    const wednesday2pm = rows.find((r) => r.x === 3 && r.y === 14);
    expect(tuesday10am).toBeDefined();
    expect(wednesday2pm).toBeDefined();
    expect(Number(tuesday10am!.value)).toBeGreaterThanOrEqual(200);
    expect(Number(wednesday2pm!.value)).toBeGreaterThanOrEqual(300);
  });

  it('aggregates sales by year x month across both receipts', async () => {
    const res = await agent(app)
      .get('/api/v1/charts/heatmap')
      .query({ type: 'year-month', metric: 'sales' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as { x: number; y: number; value: string }[];
    const jan2999 = rows.find((r) => r.x === 2999 && r.y === 1);
    expect(Number(jan2999!.value)).toBe(500);
  });

  it('computes avg unit cost by region x category from product_costs', async () => {
    const res = await agent(app)
      .get('/api/v1/charts/heatmap')
      .query({ type: 'region-category' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as { x: string; y: string; value: string }[];
    const ours = rows.find(
      (r) => r.x === 'E2E Region' && r.y === 'E2E Category',
    );
    expect(ours).toBeDefined();
    expect(Number(ours!.value)).toBe(60);
  });

  // The remaining tests assert lower bounds (>=), not exact totals: these
  // endpoints aggregate across the whole table, and other e2e spec files
  // running concurrently against the same database also insert receipts.
  // Only per-entity lookups (by our seeded names, above) can assert exact
  // numbers safely under that concurrency.

  it('places our known receipts in the medium and large basket buckets', async () => {
    const res = await agent(app)
      .get('/api/v1/charts/basket-size')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as { bucket: string; count: number }[];
    const medium = rows.find((r) => r.bucket === 'medium'); // our 200 receipt
    const large = rows.find((r) => r.bucket === 'large'); // our 300 receipt
    expect(medium?.count).toBeGreaterThanOrEqual(1);
    expect(large?.count).toBeGreaterThanOrEqual(1);
  });

  it('puts our two-visit customer in the occasional loyalty tier', async () => {
    const res = await agent(app)
      .get('/api/v1/charts/customer-loyalty')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as { bucket: string; count: number }[];
    const occasional = rows.find((r) => r.bucket === 'occasional');
    expect(occasional?.count).toBeGreaterThanOrEqual(1);
  });

  it('includes at least our known sales/cost/profit in the waterfall', async () => {
    const res = await agent(app)
      .get('/api/v1/charts/profit-waterfall')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const steps = res.body.data as { step: string; value: number }[];
    const sales = steps.find((s) => s.step === 'sales')!;
    const cost = steps.find((s) => s.step === 'cost')!;
    const profit = steps.find((s) => s.step === 'profit')!;
    expect(sales.value).toBeGreaterThanOrEqual(500);
    expect(cost.value).toBeLessThanOrEqual(-300);
    expect(profit.value).toBeGreaterThanOrEqual(200);
  });

  it('places our branch on the geographic map with its exact coordinates', async () => {
    const res = await agent(app)
      .get('/api/v1/charts/geographic-sales')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as {
      name: string;
      latitude: number;
      longitude: number;
      sales: string;
    }[];
    const ours = rows.find((r) => r.name === 'E2E Branch');
    expect(ours).toBeDefined();
    expect(ours!.latitude).toBeCloseTo(40.98);
    expect(ours!.longitude).toBeCloseTo(29.03);
    expect(Number(ours!.sales)).toBe(500);
  });
});
