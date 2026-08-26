import { Injectable } from '@nestjs/common';
import type {
  BrandDto,
  CategoryDto,
  ProductDto,
  SubcategoryDto,
} from '@hakmar/contracts';
import { CrudService, type PrismaDelegate } from '../common';
import { PrismaService } from '../prisma';

@Injectable()
export class CategoriesService extends CrudService<CategoryDto> {
  protected readonly delegate: PrismaDelegate<CategoryDto>;
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
export class SubcategoriesService extends CrudService<SubcategoryDto> {
  protected readonly delegate: PrismaDelegate<SubcategoryDto>;
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
export class BrandsService extends CrudService<BrandDto> {
  protected readonly delegate: PrismaDelegate<BrandDto>;
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
export class ProductsService extends CrudService<ProductDto> {
  protected readonly delegate: PrismaDelegate<ProductDto>;
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
