import { BadRequestException, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { ObjectType } from './object-type.entity';
import { Place } from './place.entity';
import { SEED_CATEGORIES, SEED_PLACES } from './reference.seed';

export const UNIDENTIFIED = 'Unidentified';

@Injectable()
export class ReferenceService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(ObjectType) private readonly objectTypes: Repository<ObjectType>,
    @InjectRepository(Place) private readonly places: Repository<Place>,
  ) {}

  // Called by NestJS once, when the server starts.
  async onApplicationBootstrap(): Promise<void> {
    await this.seedIfEmpty();
  }

  // Fills the empty reference tables with the starting lists of reference.seed.ts.
  async seedIfEmpty(): Promise<void> {
    if ((await this.categories.count()) === 0) {
      for (const [categoryName, objectTypeNames] of Object.entries(SEED_CATEGORIES)) {
        const category = await this.categories.save(this.categories.create({ name: categoryName }));
        await this.objectTypes.save(
          objectTypeNames.map((name) => this.objectTypes.create({ categoryId: category.id, name })),
        );
      }
    }

    if ((await this.places.count()) === 0) {
      await this.places.save(SEED_PLACES.map((name) => this.places.create({ name })));
    }
  }

  // FR-32: the reception staff do not know the category, the precise object or the place, so they
  // all are "Unidentified". The three rows are created the first time they are needed.
  async getUnidentified(): Promise<{ categoryId: number; objectTypeId: number; placeId: number }> {
    let category = await this.categories.findOneBy({ name: UNIDENTIFIED });
    if (!category) {
      category = await this.categories.save(this.categories.create({ name: UNIDENTIFIED }));
    }
    let objectType = await this.objectTypes.findOneBy({ categoryId: category.id, name: UNIDENTIFIED });
    if (!objectType) {
      objectType = await this.objectTypes.save(
        this.objectTypes.create({ categoryId: category.id, name: UNIDENTIFIED }),
      );
    }
    let place = await this.places.findOneBy({ name: UNIDENTIFIED });
    if (!place) {
      place = await this.places.save(this.places.create({ name: UNIDENTIFIED }));
    }
    return { categoryId: category.id, objectTypeId: objectType.id, placeId: place.id };
  }

  // Returns the lists used by the form: the categories with their precise objects, and the places.
  async getAll() {
    const categories = await this.categories.find({
      relations: { objectTypes: true },
      order: { name: 'ASC', objectTypes: { name: 'ASC' } },
    });
    const places = await this.places.find({ where: { isActive: true }, order: { name: 'ASC' } });

    return {
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        objectTypes: category.objectTypes.map((objectType) => ({
          id: objectType.id,
          name: objectType.name,
        })),
      })),
      places: places.map((place) => ({ id: place.id, name: place.name })),
    };
  }

  // Checks that the ids chosen in the form exist, and that the precise object belongs to the category.
  async checkSelection(categoryId: number, objectTypeId: number, placeId: number): Promise<void> {
    const objectType = await this.objectTypes.findOneBy({ id: objectTypeId });
    if (!objectType || objectType.categoryId !== categoryId) {
      throw new BadRequestException('Choose a precise object that belongs to the selected category.');
    }

    const place = await this.places.findOneBy({ id: placeId, isActive: true });
    if (!place) {
      throw new BadRequestException('Choose a place from the list.');
    }
  }

  // SCRUM-23: checks the filters of the gallery. Unlike checkSelection, every id is optional:
  // only the ids that are sent are checked.
  async checkFilters(categoryId?: number, objectTypeId?: number, placeId?: number): Promise<void> {
    if (objectTypeId) {
      const objectType = await this.objectTypes.findOneBy({ id: objectTypeId });
      if (!objectType || (categoryId && objectType.categoryId !== categoryId)) {
        throw new BadRequestException('Choose a precise object that belongs to the selected category.');
      }
    }
    if (categoryId && !(await this.categories.findOneBy({ id: categoryId }))) {
      throw new BadRequestException('Choose a category from the list.');
    }
    if (placeId && !(await this.places.findOneBy({ id: placeId, isActive: true }))) {
      throw new BadRequestException('Choose a place from the list.');
    }
  }
}
