import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { agent, createTestApp } from './support/test-app';

const USERNAME = process.env.SEED_ADMIN_USERNAME ?? 'superadmin';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

interface ReceiptRow {
  id: number;
  receiptDate: string;
  branchName: string;
  cashierName: string;
  customerName: string;
  itemCount: number;
  total: string;
  margin: string;
}

interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

describe('Transactions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  let regionId: number;
  let cityId: number;
  let branchId: number;
  let otherBranchId: number;
  let categoryId: number;
  let subcategoryId: number;
  let brandCode: string;
  let productAId: number;
  let productBId: number;
  let customerId: number;
  let cashierId: number;
  let receiptIds: number[] = [];
  let janFirstId = 0;
  let janThirtyFirstId = 0;
  let emptyReceiptId = 0;

  async function list(query: Record<string, unknown>) {
    const res = await agent(app)
      .get('/api/v1/transactions/receipts')
      .query(query)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body.data as Page<ReceiptRow>;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const login = await agent(app)
      .post('/api/v1/auth/login')
      .send({ username: USERNAME, password: PASSWORD })
      .expect(200);
    token = login.body.data.accessToken as string;

    const region = await prisma.region.create({ data: { name: 'TX Region' } });
    regionId = region.id;
    const city = await prisma.city.create({
      data: { name: 'TX City', plateCode: 995, regionId },
    });
    cityId = city.id;
    const branch = await prisma.branch.create({
      data: { name: 'TX Branch', cityId },
    });
    branchId = branch.id;
    const other = await prisma.branch.create({
      data: { name: 'TX Other Branch', cityId },
    });
    otherBranchId = other.id;
    const category = await prisma.category.create({ data: { name: 'TX Cat' } });
    categoryId = category.id;
    const subcategory = await prisma.subcategory.create({
      data: { name: 'TX Sub', categoryId },
    });
    subcategoryId = subcategory.id;
    const brand = await prisma.brand.create({
      data: { code: 'TXBR', name: 'TX Brand', categoryId },
    });
    brandCode = brand.code;
    const productA = await prisma.product.create({
      data: { name: 'TX Product A', brandCode, subcategoryId },
    });
    productAId = productA.id;
    const productB = await prisma.product.create({
      data: { name: 'TX Product B', brandCode, subcategoryId },
    });
    productBId = productB.id;
    const customer = await prisma.customer.create({
      data: { firstName: 'TX', lastName: 'Customer', gender: 'M' },
    });
    customerId = customer.id;
    const cashier = await prisma.cashier.create({
      data: { firstName: 'TX', lastName: 'Cashier', branchId },
    });
    cashierId = cashier.id;

    const time = new Date('1970-01-01T09:30:00Z');
    const ids: number[] = [];

    // Far-future dates so these rows cannot collide with any real data.
    // 2999-01-01 with two line items, 2999-01-31 with one, and one receipt
    // with no items at all.
    const first = await prisma.receipt.create({
      data: {
        branchId,
        cashierId,
        customerId,
        receiptDate: new Date('2999-01-01'),
        receiptTime: time,
      },
    });
    janFirstId = first.id;
    ids.push(first.id);
    await prisma.receiptItem.createMany({
      data: [
        {
          receiptId: first.id,
          productId: productAId,
          quantity: 2,
          totalPrice: 200,
          totalCost: 120,
          totalMargin: 80,
        },
        {
          receiptId: first.id,
          productId: productBId,
          quantity: 1,
          totalPrice: 50,
          totalCost: 30,
          totalMargin: 20,
        },
      ],
    });

    const last = await prisma.receipt.create({
      data: {
        branchId,
        cashierId,
        customerId,
        receiptDate: new Date('2999-01-31'),
        receiptTime: time,
      },
    });
    janThirtyFirstId = last.id;
    ids.push(last.id);
    await prisma.receiptItem.create({
      data: {
        receiptId: last.id,
        productId: productAId,
        quantity: 5,
        totalPrice: 500,
        totalCost: 300,
        totalMargin: 200,
      },
    });

    const outside = await prisma.receipt.create({
      data: {
        branchId: otherBranchId,
        cashierId,
        customerId,
        receiptDate: new Date('2999-02-15'),
        receiptTime: time,
      },
    });
    ids.push(outside.id);
    await prisma.receiptItem.create({
      data: {
        receiptId: outside.id,
        productId: productBId,
        quantity: 1,
        totalPrice: 60,
        totalCost: 40,
        totalMargin: 20,
      },
    });

    const empty = await prisma.receipt.create({
      data: {
        branchId,
        cashierId,
        customerId,
        receiptDate: new Date('2999-01-15'),
        receiptTime: time,
      },
    });
    emptyReceiptId = empty.id;
    ids.push(empty.id);

    receiptIds = ids;
  });

  afterAll(async () => {
    await prisma.receiptItem.deleteMany({
      where: { receiptId: { in: receiptIds } },
    });
    await prisma.receipt.deleteMany({ where: { id: { in: receiptIds } } });
    await prisma.product.deleteMany({
      where: { id: { in: [productAId, productBId] } },
    });
    await prisma.brand.delete({ where: { code: brandCode } });
    await prisma.subcategory.delete({ where: { id: subcategoryId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.cashier.delete({ where: { id: cashierId } });
    await prisma.customer.delete({ where: { id: customerId } });
    await prisma.branch.deleteMany({
      where: { id: { in: [branchId, otherBranchId] } },
    });
    await prisma.city.delete({ where: { id: cityId } });
    await prisma.region.delete({ where: { id: regionId } });
    await app.close();
  });

  it('rolls each receipt up to its item count and totals', async () => {
    const page = await list({ dateFrom: '2999-01-01', dateTo: '2999-01-01' });

    expect(page.items).toHaveLength(1);
    const row = page.items[0];
    expect(row.id).toBe(janFirstId);
    expect(row.itemCount).toBe(2);
    expect(Number(row.total)).toBe(250);
    expect(Number(row.margin)).toBe(100);
    expect(row.branchName).toBe('TX Branch');
    expect(row.cashierName).toBe('TX Cashier');
    expect(row.customerName).toBe('TX Customer');
  });

  /**
   * receipt_date is a DATE column, so an inclusive upper bound has to
   * actually include the day named. An off-by-one here silently drops the
   * last day of every range a user asks for.
   */
  it('includes both ends of the date range', async () => {
    const page = await list({ dateFrom: '2999-01-01', dateTo: '2999-01-31' });
    const ids = page.items.map((r) => r.id);

    expect(ids).toContain(janFirstId);
    expect(ids).toContain(janThirtyFirstId);
    expect(page.total).toBe(3); // plus the itemless one on the 15th
  });

  it('excludes what falls outside the range', async () => {
    const page = await list({ dateFrom: '2999-01-01', dateTo: '2999-01-30' });
    expect(page.items.map((r) => r.id)).not.toContain(janThirtyFirstId);
  });

  it('keeps a receipt with no line items, at zero', async () => {
    const page = await list({ dateFrom: '2999-01-15', dateTo: '2999-01-15' });

    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe(emptyReceiptId);
    expect(page.items[0].itemCount).toBe(0);
    expect(Number(page.items[0].total)).toBe(0);
  });

  it('filters by branch', async () => {
    const page = await list({
      branchId: otherBranchId,
      dateFrom: '2999-01-01',
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].branchName).toBe('TX Other Branch');
  });

  it.each([
    ['cashierId', () => cashierId, 4],
    ['customerId', () => customerId, 4],
  ])('filters by %s', async (_key, getId, expected) => {
    const page = await list({
      [_key]: getId(),
      dateFrom: '2999-01-01',
      dateTo: '2999-12-31',
    });
    expect(page.total).toBe(expected);
  });

  it('returns newest first', async () => {
    const page = await list({ dateFrom: '2999-01-01', dateTo: '2999-12-31' });
    const dates = page.items.map((r) => new Date(r.receiptDate).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  /**
   * The count query deliberately omits the join to receipt_items. With it,
   * the total would be a count of line items and the pagination would claim
   * more pages than exist.
   */
  it('counts receipts, not line items', async () => {
    const page = await list({
      dateFrom: '2999-01-01',
      dateTo: '2999-12-31',
      limit: 1,
    });

    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(4);
  });

  it('paginates without repeating or skipping rows', async () => {
    const first = await list({
      dateFrom: '2999-01-01',
      dateTo: '2999-12-31',
      limit: 2,
      offset: 0,
    });
    const second = await list({
      dateFrom: '2999-01-01',
      dateTo: '2999-12-31',
      limit: 2,
      offset: 2,
    });

    const ids = [...first.items, ...second.items].map((r) => r.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('returns a receipt with its line items', async () => {
    const res = await agent(app)
      .get(`/api/v1/transactions/receipts/${janFirstId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const receipt = res.body.data as ReceiptRow & {
      items: { productName: string; brandName: string; totalPrice: string }[];
    };

    expect(receipt.itemCount).toBe(2);
    expect(Number(receipt.total)).toBe(250);
    expect(receipt.items).toHaveLength(2);
    const names = receipt.items.map((i) => i.productName).sort();
    expect(names).toEqual(['TX Product A', 'TX Product B']);
    expect(receipt.items[0].brandName).toBe('TX Brand');
  });

  it('returns an empty item list rather than failing for an itemless receipt', async () => {
    const res = await agent(app)
      .get(`/api/v1/transactions/receipts/${emptyReceiptId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.itemCount).toBe(0);
  });

  it('returns 404 for a receipt that does not exist', async () => {
    const res = await agent(app)
      .get('/api/v1/transactions/receipts/99999999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  describe('input handling', () => {
    it.each([
      ['a malformed date', { dateFrom: 'yesterday' }],
      ['a non-numeric branch', { branchId: 'abc' }],
      ['a limit past the cap', { limit: 5000 }],
      ['a negative offset', { offset: -1 }],
      ['an unknown parameter', { orderBy: 'total' }],
    ])('rejects %s with 400', async (_why, query) => {
      const res = await agent(app)
        .get('/api/v1/transactions/receipts')
        .query(query)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    // Filters are bound parameters, never concatenated, so this is rejected
    // by validation before it can reach the database at all.
    it('rejects an injection attempt in a filter', async () => {
      const res = await agent(app)
        .get('/api/v1/transactions/receipts')
        .query({ branchId: '1; DROP TABLE receipts' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);

      const stillThere = await prisma.receipt.count();
      expect(stillThere).toBeGreaterThan(0);
    });
  });

  it('requires authentication', async () => {
    const res = await agent(app).get('/api/v1/transactions/receipts');
    expect(res.status).toBe(401);
  });
});
