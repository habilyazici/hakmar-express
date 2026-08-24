import { Module } from '@nestjs/common';
import { CashiersController, CustomersController } from './people.controller';
import { CashiersService, CustomersService } from './people.services';

@Module({
  controllers: [CustomersController, CashiersController],
  providers: [CustomersService, CashiersService],
})
export class PeopleModule {}
