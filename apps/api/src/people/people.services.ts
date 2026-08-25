import { Injectable } from '@nestjs/common';
import { CrudService, type PrismaDelegate } from '../common';
import { PrismaService } from '../prisma';

@Injectable()
export class CustomersService extends CrudService<unknown> {
  protected readonly delegate: PrismaDelegate;
  protected override readonly config = {
    searchFields: ['firstName', 'lastName'],
    orderBy: { lastName: 'asc' as const },
  };

  constructor(prisma: PrismaService) {
    super();
    this.delegate = prisma.customer;
  }
}

@Injectable()
export class CashiersService extends CrudService<unknown> {
  protected readonly delegate: PrismaDelegate;
  protected override readonly config = {
    searchFields: ['firstName', 'lastName'],
    include: { branch: { select: { id: true, name: true } } },
    orderBy: { lastName: 'asc' as const },
  };

  constructor(prisma: PrismaService) {
    super();
    this.delegate = prisma.cashier;
  }
}
