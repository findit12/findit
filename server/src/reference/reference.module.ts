import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './category.entity';
import { ObjectType } from './object-type.entity';
import { Place } from './place.entity';
import { ReferenceController } from './reference.controller';
import { ReferenceService } from './reference.service';

@Module({
  imports: [TypeOrmModule.forFeature([Category, ObjectType, Place])],
  controllers: [ReferenceController],
  providers: [ReferenceService],
  // AnnouncementsModule uses ReferenceService to check the ids sent by the form.
  exports: [ReferenceService],
})
export class ReferenceModule {}
