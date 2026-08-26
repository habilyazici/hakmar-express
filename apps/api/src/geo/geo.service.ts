import { Injectable } from '@nestjs/common';
import type { BranchDto, CityDto, RegionDto } from '@hakmar/contracts';
import { CrudService, type PrismaDelegate } from '../common';
import { PrismaService } from '../prisma';

@Injectable()
export class RegionsService extends CrudService<RegionDto> {
  protected readonly delegate: PrismaDelegate<RegionDto>;
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
export class CitiesService extends CrudService<CityDto> {
  protected readonly delegate: PrismaDelegate<CityDto>;
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
export class BranchesService extends CrudService<BranchDto> {
  protected readonly delegate: PrismaDelegate<BranchDto>;
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
