import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { ReferenceModule } from '../reference/reference.module';
import { SavedSearch } from './saved-search.entity';
import { SavedSearchesController } from './saved-searches.controller';
import { SavedSearchesService } from './saved-searches.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SavedSearch]),
    AuthModule, // gives JwtService, used by JwtAuthGuard
    MailModule,
    ReferenceModule, // gives ReferenceService, used to check the filters
  ],
  controllers: [SavedSearchesController],
  providers: [SavedSearchesService],
  exports: [SavedSearchesService], // used by AnnouncementsService to send the alerts
})
export class SavedSearchesModule {}
