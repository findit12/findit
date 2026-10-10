import { BadRequestException, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { ObjectType } from './object-type.entity';
import { Place } from './place.entity';
import { SEED_CATEGORIES, SEED_PLACES } from './reference.seed';

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
}
