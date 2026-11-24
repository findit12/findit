import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthToken } from '../auth/auth-token.entity';
import { AuthModule } from '../auth/auth.module';
import { SavedSearch } from '../saved-searches/saved-search.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, AuthToken, SavedSearch]), AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [TypeOrmModule],
})
export class UsersModule {}
