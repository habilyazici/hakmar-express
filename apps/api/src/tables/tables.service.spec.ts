import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma';
import { TableEntity } from './dto/table-ranking-query.dto';
import { TablesService } from './tables.service';

interface CapturedSql {
  sql: string;
  values: unknown[];
}

function lastQuery(mockFn: jest.Mock): CapturedSql {
  const calls = mockFn.mock.calls as unknown[][];
  return calls[0][0] as CapturedSql;
}

describe('TablesService', () => {
  let service: TablesService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const moduleRef = await Test.createTestingModule({
      providers: [TablesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(TablesService);
  });

  it.each([
    [TableEntity.CASHIER, 'FROM cashiers'],
    [TableEntity.BRANCH, 'FROM branches'],
    [TableEntity.PRODUCT, 'FROM products'],
    [TableEntity.CUSTOMER, 'FROM customers'],
  ])('routes %s to the query starting %s', async (entity, expectedFrom) => {
    await service.getRanking(entity, 20);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const query = lastQuery(prisma.$queryRaw);
    expect(query.sql).toContain(expectedFrom);
  });

  it('passes the limit through as a bound parameter, not inlined text', async () => {
    await service.getRanking(TableEntity.BRANCH, 42);

    const query = lastQuery(prisma.$queryRaw);
    expect(query.sql).not.toContain('42');
    expect(query.values).toContain(42);
  });

  it('getPriceCostHistory queries product_prices with a LAG window function', async () => {
    await service.getPriceCostHistory(50);

    const query = lastQuery(prisma.$queryRaw);
    expect(query.sql).toContain('product_prices');
    expect(query.sql).toContain('LAG(');
  });

  it('getRegionCost joins product_costs to regions and products', async () => {
    await service.getRegionCost(50);

    const query = lastQuery(prisma.$queryRaw);
    expect(query.sql).toContain('FROM product_costs');
    expect(query.sql).toContain('JOIN regions');
  });

  /**
   * The sales figures must reach the outer GROUP BY already summed per cost
   * row. Joining receipt_items straight in duplicates each product_costs row
   * once per sale made against it, which silently turns the average unit
   * cost into one weighted by sales volume. Asserting on the shape catches
   * that reappearing without needing a database.
   */
  it('getRegionCost sums the line items per cost row before joining', async () => {
    await service.getRegionCost(50);

    const query = lastQuery(prisma.$queryRaw);
    expect(query.sql).toContain('GROUP BY ri.cost_id');
    expect(query.sql).not.toMatch(/LEFT JOIN receipt_items ri ON ri\.cost_id/);
  });
});
