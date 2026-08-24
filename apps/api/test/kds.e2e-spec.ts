import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { agent, createTestApp } from './support/test-app';

const USERNAME = process.env.SEED_ADMIN_USERNAME ?? 'superadmin';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

describe('KDS Analytics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  let regionId: number;
  let cityId: number;
  let branchId: number;
  let categoryId: number;
  let subcategoryId: number;
  let brandCode: string;
  let productAId: number;
  let productBId: number;
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

    const region = await prisma.region.create({ data: { name: 'KDS Region' } });
    regionId = region.id;
    const city = await prisma.city.create({
      data: { name: 'KDS City', plateCode: 997, regionId },
    });
    cityId = city.id;
    const branch = await prisma.branch.create({
      data: { name: 'KDS Branch', cityId },
    });
    branchId = branch.id;
    const category = await prisma.category.create({
      data: { name: 'KDS Category' },
    });
    categoryId = category.id;
    const subcategory = await prisma.subcategory.create({
      data: { name: 'KDS Subcategory', categoryId },
    });
    subcategoryId = subcategory.id;
    const brand = await prisma.brand.create({
      data: { code: 'KDSBR', name: 'KDS Brand', categoryId },
    });
    brandCode = brand.code;
    const productA = await prisma.product.create({
      data: { name: 'KDS Alpha', brandCode, subcategoryId },
    });
    productAId = productA.id;
    const productB = await prisma.product.create({
      data: { name: 'KDS Beta', brandCode, subcategoryId },
    });
    productBId = productB.id;
    const customer = await prisma.customer.create({
      data: { firstName: 'KDS', lastName: 'Customer', gender: 'F' },
    });
    customerId = customer.id;
    const cashier = await prisma.cashier.create({
      data: { firstName: 'KDS', lastName: 'Cashier', branchId },
    });
    cashierId = cashier.id;

    const receiptTime = new Date('1970-01-01T09:00:00Z');

    // R1: Alpha alone, 6 days ago, qty 10.
    const r1 = await prisma.receipt.create({
      data: {
        branchId,
        cashierId,
        customerId,
        receiptDate: daysAgo(6),
        receiptTime,
      },
    });
    await prisma.receiptItem.create({
      data: {
        receiptId: r1.id,
        productId: productAId,
        quantity: 10,
        totalPrice: 100,
        totalCost: 60,
        totalMargin: 40,
      },
    });

    // R2: Alpha + Beta together, 3 days ago — the only co-purchase receipt.
    const r2 = await prisma.receipt.create({
      data: {
        branchId,
        cashierId,
        customerId,
        receiptDate: daysAgo(3),
        receiptTime,
      },
    });
    await prisma.receiptItem.create({
      data: {
        receiptId: r2.id,
        productId: productAId,
        quantity: 20,
        totalPrice: 200,
        totalCost: 120,
        totalMargin: 80,
      },
    });
    await prisma.receiptItem.create({
      data: {
        receiptId: r2.id,
        productId: productBId,
        quantity: 1,
        totalPrice: 15,
        totalCost: 9,
        totalMargin: 6,
      },
    });

    // R3: Alpha alone, today, qty 30 — the most recent Alpha activity.
    const r3 = await prisma.receipt.create({
      data: {
        branchId,
        cashierId,
        customerId,
        receiptDate: daysAgo(0),
        receiptTime,
      },
    });
    await prisma.receiptItem.create({
      data: {
        receiptId: r3.id,
        productId: productAId,
        quantity: 30,
        totalPrice: 300,
        totalCost: 180,
        totalMargin: 120,
      },
    });

    // R4: Beta alone (no Alpha) — keeps market-basket confidence below 100%.
    const r4 = await prisma.receipt.create({
      data: {
        branchId,
        cashierId,
        customerId,
        receiptDate: daysAgo(3),
        receiptTime,
      },
    });
    await prisma.receiptItem.create({
      data: {
        receiptId: r4.id,
        productId: productBId,
        quantity: 1,
        totalPrice: 15,
        totalCost: 9,
        totalMargin: 6,
      },
    });

    receiptIds = [r1.id, r2.id, r3.id, r4.id];
  });

  afterAll(async () => {
    await prisma.receiptItem.deleteMany({
      where: { receiptId: { in: receiptIds } },
    });
    await prisma.receipt.deleteMany({ where: { id: { in: receiptIds } } });
    await prisma.product.delete({ where: { id: productAId } });
    await prisma.product.delete({ where: { id: productBId } });
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

  it('computes exact cumulative revenue for the seeded product regardless of other products in the window', async () => {
    const res = await agent(app)
      .get('/api/v1/kds/abc-analysis')
      .query({ days: 90 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as {
      id: number;
      name: string;
      revenue: string;
      class: string;
    }[];
    // Matched by name, not the freshly-generated id: this endpoint is
    // cached by URL, so a concurrently-running suite may have already
    // populated the cache from a previous run's (since-deleted) row ids —
    // the name is the one thing that's identical and deterministic run to run.
    const ours = rows.find((r) => r.name === 'KDS Alpha');
    expect(ours).toBeDefined();
    // 100 (R1) + 200 (R2) + 300 (R3) — Beta's revenue does not leak into Alpha's row.
    expect(Number(ours!.revenue)).toBe(600);
    expect(['A', 'B', 'C']).toContain(ours!.class);
  });

  it("excludes a product with zero revenue in the window from contaminating another product's total", async () => {
    const res = await agent(app)
      .get('/api/v1/kds/abc-analysis')
      .query({ days: 90 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as {
      id: number;
      name: string;
      revenue: string;
    }[];
    const ours = rows.find((r) => r.name === 'KDS Beta');
    expect(ours).toBeDefined();
    // R2 (15) + R4 (15).
    expect(Number(ours!.revenue)).toBe(30);
  });

  it('computes the 7-day moving average of quantity at the most recent day with data', async () => {
    const res = await agent(app)
      .get('/api/v1/kds/demand-forecast')
      .query({ limit: 500 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as {
      productId: number;
      productName: string;
      forecastQty: string;
    }[];
    const ours = rows.find((r) => r.productName === 'KDS Alpha');
    expect(ours).toBeDefined();
    // Three sale-days for Alpha (qty 10, 20, 30) all fall inside the
    // ROWS BETWEEN 6 PRECEDING window, so the average at the latest day is
    // (10 + 20 + 30) / 3 = 20.
    expect(Number(ours!.forecastQty)).toBeCloseTo(20, 5);
  });

  it('computes exact RFM aggregates for the seeded customer', async () => {
    const res = await agent(app)
      .get('/api/v1/kds/customer-segmentation')
      .query({ limit: 500 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as {
      id: number;
      name: string;
      recencyDays: number | null;
      frequency: number;
      monetary: string;
      segment: string;
    }[];
    const ours = rows.find((r) => r.name === 'KDS Customer');
    expect(ours).toBeDefined();
    expect(ours!.recencyDays).toBe(0);
    expect(ours!.frequency).toBe(4);
    // 100 + (200 + 15) + 300 + 15 = 630.
    expect(Number(ours!.monetary)).toBe(630);
    expect(['Champions', 'Loyal', 'At Risk', 'Lost']).toContain(ours!.segment);
  });

  it('computes exact co-purchase confidence for the market basket of the seeded product', async () => {
    const res = await agent(app)
      .get('/api/v1/kds/market-basket')
      .query({ productId: productAId, limit: 100 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as {
      productId: number;
      productName: string;
      coCount: number;
      confidencePct: string | null;
    }[];
    const ours = rows.find((r) => r.productName === 'KDS Beta');
    expect(ours).toBeDefined();
    // Beta co-occurs with Alpha in exactly 1 of Alpha's 3 receipts.
    expect(ours!.coCount).toBe(1);
    expect(Number(ours!.confidencePct)).toBeCloseTo(33.3, 1);
  });

  it('rejects a market-basket request without a productId', async () => {
    const res = await agent(app)
      .get('/api/v1/kds/market-basket')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });
});
