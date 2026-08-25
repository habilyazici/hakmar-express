import { Injectable } from '@nestjs/common';
import { CrudService, type PrismaDelegate } from '../common';
import { PrismaService } from '../prisma';

@Injectable()
export class RegionsService extends CrudService<unknown> {
  protected readonly delegate: PrismaDelegate;
  protected override readonly config = {
    searchFields: ['name'],
    orderBy: { name: 'asc' as const },
  };

  constructor(prisma: PrismaService) {
    super();
    this.delegate = prisma.region;
  }
}

@Injectable()
export class CitiesService extends CrudService<unknown> {
  protected readonly delegate: PrismaDelegate;
  protected override readonly config = {
    searchFields: ['name'],
    include: { region: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' as const },
  };

  constructor(prisma: PrismaService) {
    super();
    this.delegate = prisma.city;
  }
}

@Injectable()
export class BranchesService extends CrudService<unknown> {
  protected readonly delegate: PrismaDelegate;
  protected override readonly config = {
    searchFields: ['name'],
    include: {
      city: {
        select: {
          id: true,
          name: true,
          region: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { name: 'asc' as const },
  };

  constructor(prisma: PrismaService) {
    super();
    this.delegate = prisma.branch;
  }
}
