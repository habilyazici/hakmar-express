import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
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
});
