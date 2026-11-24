import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Category } from './category.entity';
import { ObjectType } from './object-type.entity';
import { Place } from './place.entity';
import { ReferenceController } from './reference.controller';
import { CategoriesController, ObjectTypesController, PlacesController } from './reference-crud.controllers';
import { ReferenceCrudService } from './reference-crud.service';
import { ReferenceService } from './reference.service';

@Module({
  imports: [TypeOrmModule.forFeature([Category, ObjectType, Place]), AuthModule],
  controllers: [ReferenceController, CategoriesController, ObjectTypesController, PlacesController],
  providers: [ReferenceService, ReferenceCrudService],
  // AnnouncementsModule uses ReferenceService to check the ids sent by the form.
  exports: [ReferenceService],
})
export class ReferenceModule {}
