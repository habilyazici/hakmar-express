import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { agent, createTestApp } from './support/test-app';

const USERNAME = process.env.SEED_ADMIN_USERNAME ?? 'superadmin';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

describe('Tables (e2e)', () => {
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
  let receiptId: number;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const login = await agent(app)
      .post('/api/v1/auth/login')
      .send({ username: USERNAME, password: PASSWORD })
      .expect(200);
    accessToken = login.body.data.accessToken as string;

    const region = await prisma.region.create({ data: { name: 'T2 Region' } });
    regionId = region.id;
    const city = await prisma.city.create({
      data: { name: 'T2 City', plateCode: 998, regionId },
    });
    cityId = city.id;
    const branch = await prisma.branch.create({
      data: { name: 'T2 Branch', cityId },
    });
    branchId = branch.id;
    const category = await prisma.category.create({
      data: { name: 'T2 Category' },
    });
    categoryId = category.id;
    const subcategory = await prisma.subcategory.create({
      data: { name: 'T2 Subcategory', categoryId },
    });
    subcategoryId = subcategory.id;
    const brand = await prisma.brand.create({
      data: { code: 'T2BR', name: 'T2 Brand', categoryId },
    });
    brandCode = brand.code;
    const product = await prisma.product.create({
      data: { name: 'T2 Product', brandCode, subcategoryId },
    });
    productId = product.id;
    const customer = await prisma.customer.create({
      data: { firstName: 'T2', lastName: 'Customer', gender: 'M' },
    });
    customerId = customer.id;
    const cashier = await prisma.cashier.create({
      data: { firstName: 'T2', lastName: 'Cashier', branchId },
    });
    cashierId = cashier.id;

    const receipt = await prisma.receipt.create({
      data: {
        branchId,
        cashierId,
        customerId,
        receiptDate: new Date('2026-02-01'),
        receiptTime: new Date('1970-01-01T09:00:00Z'),
      },
    });
    receiptId = receipt.id;
    await prisma.receiptItem.create({
      data: {
        receiptId,
        productId,
        quantity: 4,
        totalPrice: 400,
        totalCost: 240,
        totalMargin: 160,
      },
    });
  });

  afterAll(async () => {
    await prisma.receiptItem.deleteMany({ where: { receiptId } });
    await prisma.receipt.delete({ where: { id: receiptId } });
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

  it('ranks the seeded branch with the exact totals', async () => {
    const res = await agent(app)
      .get('/api/v1/tables/ranking')
      .query({ entity: 'branch', limit: 500 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as {
      name: string;
      totalSales: string;
      totalReceipts: string;
      uniqueCustomers: string;
    }[];
    const ours = rows.find((r) => r.name === 'T2 Branch');
    expect(ours).toBeDefined();
    expect(Number(ours!.totalSales)).toBe(400);
    expect(Number(ours!.totalReceipts)).toBe(1);
    expect(Number(ours!.uniqueCustomers)).toBe(1);
  });

  it('ranks the seeded product with quantity and margin', async () => {
    const res = await agent(app)
      .get('/api/v1/tables/ranking')
      .query({ entity: 'product', limit: 500 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as {
      name: string;
      totalQuantity: string;
      totalMargin: string;
    }[];
    const ours = rows.find((r) => r.name === 'T2 Product');
    expect(ours).toBeDefined();
    expect(Number(ours!.totalQuantity)).toBe(4);
    expect(Number(ours!.totalMargin)).toBe(160);
  });

  it('includes zero-activity entities via the LEFT JOIN (not just top sellers)', async () => {
    const emptyCustomer = await prisma.customer.create({
      data: { firstName: 'NoPurchases', lastName: 'AtAll', gender: 'F' },
    });
    try {
      const res = await agent(app)
        .get('/api/v1/tables/ranking')
        .query({ entity: 'customer', limit: 500 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const rows = res.body.data as { name: string; totalSpend: string }[];
      const ours = rows.find((r) => r.name === 'NoPurchases AtAll');
      expect(ours).toBeDefined();
      expect(Number(ours!.totalSpend)).toBe(0);
    } finally {
      await prisma.customer.delete({ where: { id: emptyCustomer.id } });
    }
  });

  it('rejects an unknown entity', async () => {
    const res = await agent(app)
      .get('/api/v1/tables/ranking')
      .query({ entity: 'not-a-real-entity' })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });
});
