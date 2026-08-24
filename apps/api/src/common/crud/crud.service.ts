import type { Page } from './pagination.dto';

/**
 * The subset of a Prisma model delegate this base needs. Declaring it
 * structurally rather than importing a concrete delegate type keeps the base
 * usable for models with a string primary key (Brand) alongside the numeric
 * ones, without any of them losing type safety at the edges — the DTOs that
 * actually validate user input stay explicit and per-entity.
 */
export interface PrismaDelegate {
  findMany(args?: Record<string, unknown>): Promise<unknown[]>;
  count(args?: Record<string, unknown>): Promise<number>;
  findUniqueOrThrow(args: Record<string, unknown>): Promise<unknown>;
  create(args: Record<string, unknown>): Promise<unknown>;
  update(args: Record<string, unknown>): Promise<unknown>;
  delete(args: Record<string, unknown>): Promise<unknown>;
}

export interface CrudConfig {
  /** Column(s) a free-text search runs against, chosen by the service. */
  searchFields?: string[];
  /** Relations to include on list and read. */
  include?: Record<string, unknown>;
  orderBy?: Record<string, unknown>;
}

/**
 * Shared list/read/create/update/delete plumbing.
 *
 * Deliberately NOT the legacy app's generic CRUD engine, which took the
 * table and column names from the request and interpolated them into SQL.
 * Here the entity, its searchable columns and its includes are all fixed in
 * code by the concrete service; only values ever come from the caller, and
 * those are validated by an explicit DTO first.
 *
 * Errors are left to propagate: AllExceptionsFilter already maps Prisma's
 * P2025 to 404, P2002 to 409 and P2003 to 409, so a missing record, a
 * duplicate key, or a delete blocked by a foreign key each reach the client
 * correctly without a try/catch in every method.
 */
export abstract class CrudService<TEntity> {
  protected abstract readonly delegate: PrismaDelegate;
  protected readonly config: CrudConfig = {};

  async list(
    limit: number,
    offset: number,
    search?: string,
  ): Promise<Page<TEntity>> {
    const where = this.buildWhere(search);
    const [items, total] = await Promise.all([
      this.delegate.findMany({
        where,
        take: limit,
        skip: offset,
        ...(this.config.include ? { include: this.config.include } : {}),
        ...(this.config.orderBy ? { orderBy: this.config.orderBy } : {}),
      }),
      this.delegate.count({ where }),
    ]);
    return { items: items as TEntity[], total, limit, offset };
  }

  async findOne(id: number | string): Promise<TEntity> {
    return (await this.delegate.findUniqueOrThrow({
      where: this.whereUnique(id),
      ...(this.config.include ? { include: this.config.include } : {}),
    })) as TEntity;
  }

  async create(data: object): Promise<TEntity> {
    return (await this.delegate.create({ data })) as TEntity;
  }

  async update(id: number | string, data: object): Promise<TEntity> {
    return (await this.delegate.update({
      where: this.whereUnique(id),
      data,
    })) as TEntity;
  }

  async remove(id: number | string): Promise<void> {
    await this.delegate.delete({ where: this.whereUnique(id) });
  }

  /** Overridden by Brand, whose primary key is `code`, not `id`. */
  protected whereUnique(id: number | string): Record<string, unknown> {
    return { id };
  }

  private buildWhere(search?: string): Record<string, unknown> | undefined {
    const fields = this.config.searchFields;
    if (!search || !fields || fields.length === 0) return undefined;
    return {
      OR: fields.map((field) => ({
        [field]: { contains: search, mode: 'insensitive' },
      })),
    };
  }
}
