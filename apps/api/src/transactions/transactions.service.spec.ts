import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma';
import type { ReceiptQueryDto } from './dto/receipt-query.dto';
import { TransactionsService } from './transactions.service';

interface CapturedSql {
  sql: string;
  values: unknown[];
}

/** listReceipts fires the rows query and the count query together. */
function queries(mockFn: jest.Mock): CapturedSql[] {
  return (mockFn.mock.calls as unknown[][]).map(
    (call) => call[0] as CapturedSql,
  );
}

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(TransactionsService);
  });

  it('counts receipts without the join to line items', async () => {
    await service.listReceipts({} satisfies ReceiptQueryDto);

    const [rows, count] = queries(prisma.$queryRaw);
    expect(rows.sql).toContain('LEFT JOIN receipt_items');
    // With the join in it, the "total" would be a count of line items.
    expect(count.sql).toContain('COUNT(*)::int');
    expect(count.sql).not.toContain('receipt_items');
  });

  /**
   * The two bounds have to reach Postgres as calendar dates.
   *
   * Binding a JS Date made each bound an instant, which Postgres compares by
   * casting `receipt_date` up to midnight in the server's own timezone — so
   * `dateTo` included its own last day only where that timezone is at or
   * east of UTC, and silently dropped it anywhere west. Both the cast and
   * the bound value being the plain string are load-bearing.
   */
  it('compares the date range as dates, not as instants', async () => {
    await service.listReceipts({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    } satisfies ReceiptQueryDto);

    const [rows] = queries(prisma.$queryRaw);
    // Prisma.Sql renders its placeholders as `?` on this property.
    expect(rows.sql).toContain('r.receipt_date >= ?::date');
    expect(rows.sql).toContain('r.receipt_date <= ?::date');
    expect(rows.values.slice(0, 2)).toEqual(['2026-01-01', '2026-01-31']);
    expect(rows.values.some((v) => v instanceof Date)).toBe(false);
  });

  it('omits the WHERE clause entirely when nothing is filtered', async () => {
    await service.listReceipts({} satisfies ReceiptQueryDto);

    const [rows] = queries(prisma.$queryRaw);
    expect(rows.sql).not.toContain('WHERE');
  });

  it('binds every filter as a parameter rather than inlining it', async () => {
    await service.listReceipts({
      branchId: 7,
      cashierId: 8,
      customerId: 9,
    } satisfies ReceiptQueryDto);

    const [rows] = queries(prisma.$queryRaw);
    expect(rows.sql).toContain('r.branch_id = ?');
    expect(rows.sql).toContain('r.cashier_id = ?');
    expect(rows.sql).toContain('r.customer_id = ?');
    expect(rows.sql).not.toContain('= 7');
    expect(rows.values).toEqual(expect.arrayContaining([7, 8, 9]));
  });
});
