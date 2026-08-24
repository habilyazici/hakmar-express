import { Injectable } from '@nestjs/common';
import { CrudService, type PrismaDelegate } from '../common/crud/crud.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService extends CrudService<unknown> {
  protected readonly delegate: PrismaDelegate;
  protected override readonly config = {
    searchFields: ['name'],
    orderBy: { name: 'asc' as const },
  };

  constructor(prisma: PrismaService) {
    super();
    this.delegate = prisma.category;
  }
}

@Injectable()
export class SubcategoriesService extends CrudService<unknown> {
  protected readonly delegate: PrismaDelegate;
  protected override readonly config = {
    searchFields: ['name'],
    include: { category: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' as const },
  };

  constructor(prisma: PrismaService) {
    super();
    this.delegate = prisma.subcategory;
  }
}

@Injectable()
export class BrandsService extends CrudService<unknown> {
  protected readonly delegate: PrismaDelegate;
  protected override readonly config = {
    searchFields: ['name', 'code'],
    include: { category: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' as const },
  };

  constructor(prisma: PrismaService) {
    super();
    this.delegate = prisma.brand;
  }

  /** Brand is keyed by `code`, not the `id` every other entity uses. */
  protected override whereUnique(id: number | string): Record<string, unknown> {
    return { code: String(id) };
  }
}

@Injectable()
export class ProductsService extends CrudService<unknown> {
  protected readonly delegate: PrismaDelegate;
  protected override readonly config = {
    searchFields: ['name'],
    include: {
      brand: { select: { code: true, name: true } },
      subcategory: {
        select: {
          id: true,
          name: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { name: 'asc' as const },
  };

  constructor(prisma: PrismaService) {
    super();
    this.delegate = prisma.product;
  }
}
