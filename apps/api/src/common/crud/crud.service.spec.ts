import { CrudService, type PrismaDelegate } from './crud.service';

function makeDelegate() {
  return {
    findMany: jest.fn().mockResolvedValue([{ id: 1 }]),
    count: jest.fn().mockResolvedValue(1),
    findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 1 }),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({ id: 1 }),
    delete: jest.fn().mockResolvedValue({ id: 1 }),
  };
}

type Delegate = ReturnType<typeof makeDelegate>;

class NumericService extends CrudService<{ id: number }> {
  protected readonly delegate: PrismaDelegate;
  protected override readonly config = {
    searchFields: ['name', 'code'],
    include: { rel: true },
    orderBy: { name: 'asc' as const },
  };

  constructor(delegate: Delegate) {
    super();
    this.delegate = delegate;
  }
}

class NoSearchService extends CrudService<{ id: number }> {
  protected readonly delegate: PrismaDelegate;

  constructor(delegate: Delegate) {
    super();
    this.delegate = delegate;
  }
}

class StringKeyService extends CrudService<{ code: string }> {
  protected readonly delegate: PrismaDelegate;

  constructor(delegate: Delegate) {
    super();
    this.delegate = delegate;
  }

  protected override whereUnique(id: number | string) {
    return { code: String(id) };
  }
}

function firstArg(mock: jest.Mock): Record<string, unknown> {
  const calls = mock.mock.calls as Record<string, unknown>[][];
  return calls[0][0];
}

describe('CrudService', () => {
  let delegate: Delegate;

  beforeEach(() => {
    delegate = makeDelegate();
  });

  describe('list', () => {
    it('returns a page with the total alongside the items', async () => {
      delegate.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      delegate.count.mockResolvedValue(57);

      const page = await new NumericService(delegate).list(10, 20);

      expect(page).toEqual({
        items: [{ id: 1 }, { id: 2 }],
        total: 57,
        limit: 10,
        offset: 20,
      });
      expect(firstArg(delegate.findMany).take).toBe(10);
      expect(firstArg(delegate.findMany).skip).toBe(20);
    });

    /**
     * The searchable columns are fixed by the service, never taken from the
     * request. This is the line the legacy app's generic CRUD engine crossed:
     * it accepted a column name from the caller and interpolated it into SQL.
     */
    it('searches only the columns the service declares', async () => {
      await new NumericService(delegate).list(50, 0, 'abc');

      expect(firstArg(delegate.findMany).where).toEqual({
        OR: [
          { name: { contains: 'abc', mode: 'insensitive' } },
          { code: { contains: 'abc', mode: 'insensitive' } },
        ],
      });
    });

    it('ignores a search term when the service declares no searchable columns', async () => {
      await new NoSearchService(delegate).list(50, 0, 'abc');

      expect(firstArg(delegate.findMany).where).toBeUndefined();
    });

    it('applies no filter when no search term is given', async () => {
      await new NumericService(delegate).list(50, 0);

      expect(firstArg(delegate.findMany).where).toBeUndefined();
    });

    it('counts against the same filter it lists with', async () => {
      await new NumericService(delegate).list(50, 0, 'abc');

      expect(firstArg(delegate.count).where).toEqual(
        firstArg(delegate.findMany).where,
      );
    });

    it('passes the configured include and orderBy through', async () => {
      await new NumericService(delegate).list(50, 0);

      expect(firstArg(delegate.findMany).include).toEqual({ rel: true });
      expect(firstArg(delegate.findMany).orderBy).toEqual({ name: 'asc' });
    });

    it('omits include and orderBy entirely when unconfigured', async () => {
      await new NoSearchService(delegate).list(50, 0);

      const args = firstArg(delegate.findMany);
      expect('include' in args).toBe(false);
      expect('orderBy' in args).toBe(false);
    });
  });

  describe('key handling', () => {
    it('addresses records by id by default', async () => {
      await new NumericService(delegate).findOne(7);
      expect(firstArg(delegate.findUniqueOrThrow).where).toEqual({ id: 7 });
    });

    // Brand's primary key is a string code, so the base has to be overridable.
    it('honours an overridden unique key', async () => {
      await new StringKeyService(delegate).findOne('ABC');
      expect(firstArg(delegate.findUniqueOrThrow).where).toEqual({
        code: 'ABC',
      });
    });

    it('uses the same key for update and delete', async () => {
      const service = new StringKeyService(delegate);
      await service.update('ABC', { name: 'x' });
      await service.remove('ABC');

      expect(firstArg(delegate.update).where).toEqual({ code: 'ABC' });
      expect(firstArg(delegate.delete).where).toEqual({ code: 'ABC' });
    });
  });

  describe('writes', () => {
    it('passes create data straight through', async () => {
      await new NumericService(delegate).create({ name: 'new' });
      expect(firstArg(delegate.create).data).toEqual({ name: 'new' });
    });

    it('passes update data straight through', async () => {
      await new NumericService(delegate).update(3, { name: 'edited' });
      expect(firstArg(delegate.update).data).toEqual({ name: 'edited' });
    });

    // Errors are deliberately not caught here: AllExceptionsFilter maps
    // P2002/P2003/P2025 to their HTTP status, so swallowing them would turn a
    // 409 back into a 500.
    it('lets a delegate error propagate rather than swallowing it', async () => {
      delegate.delete.mockRejectedValue(new Error('FK violation'));

      await expect(new NumericService(delegate).remove(1)).rejects.toThrow(
        'FK violation',
      );
    });
  });
});
