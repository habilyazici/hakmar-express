import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// AuthModule is imported for AuthService.revokeAllSessions: an account change
// has to be able to end that account's sessions, and the refresh-token table
// belongs to Auth. This is the whole dependency — it does not run backwards,
// so there is no cycle to break.
@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
