import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { ObjectType } from './object-type.entity';
import { Place } from './place.entity';
import {
  CategoryDto,
  ObjectTypeDto,
  PlaceDto,
  UpdateCategoryDto,
  UpdateObjectTypeDto,
  UpdatePlaceDto,
} from './reference-crud.dto';

// Lab 6: the CRUD of the three reference entities. Reading is public (the forms need it); creating,
// updating and deleting is for administrators (the guard is in the controllers).
@Injectable()
export class ReferenceCrudService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(ObjectType) private readonly objectTypes: Repository<ObjectType>,
    @InjectRepository(Place) private readonly places: Repository<Place>,
  ) {}

  // PostgreSQL refuses a duplicate name (code 23505) or the deletion of a row that is still used (23503).
  // Both are the fault of the request, not of the server: they become a 409.
  private async guarded<T>(work: () => Promise<T>, what: string): Promise<T> {
    try {
      return await work();
    } catch (err) {
      const code = (err as { driverError?: { code?: string } }).driverError?.code;
      if (code === '23505') {
        throw new ConflictException(`This ${what} already exists.`);
      }
      if (code === '23503') {
        throw new ConflictException(`This ${what} is still used, it cannot be deleted.`);
      }
      throw err;
    }
  }

  // ---------- categories
  async listCategories() {
    return { categories: await this.categories.find({ order: { name: 'ASC' } }) };
  }

  async getCategory(id: number) {
    const category = await this.categories.findOneBy({ id });
    if (!category) throw new NotFoundException('Category not found.');
    return { category };
  }

  async createCategory(dto: CategoryDto) {
    const category = await this.guarded(() => this.categories.save(this.categories.create({ name: dto.name })), 'category');
    return { category };
  }

  async updateCategory(id: number, dto: UpdateCategoryDto) {
    const category = (await this.getCategory(id)).category;
    if (dto.name !== undefined) category.name = dto.name;
    return { category: await this.guarded(() => this.categories.save(category), 'category') };
  }

  async removeCategory(id: number): Promise<void> {
    await this.getCategory(id);
    await this.guarded(() => this.categories.delete(id), 'category');
  }

  // ---------- precise objects
  async listObjectTypes(categoryId?: number) {
    return {
      objectTypes: await this.objectTypes.find({
        where: categoryId ? { categoryId } : {},
        order: { name: 'ASC' },
      }),
    };
  }

  async getObjectType(id: number) {
    const objectType = await this.objectTypes.findOneBy({ id });
    if (!objectType) throw new NotFoundException('Object type not found.');
    return { objectType };
  }

  private async checkCategory(categoryId: number): Promise<void> {
    if (!(await this.categories.findOneBy({ id: categoryId }))) {
      throw new BadRequestException('Choose a category from the list.');
    }
  }

  async createObjectType(dto: ObjectTypeDto) {
    await this.checkCategory(dto.categoryId);
    const objectType = await this.objectTypes.save(
      this.objectTypes.create({ categoryId: dto.categoryId, name: dto.name }),
    );
    return { objectType };
  }

  async updateObjectType(id: number, dto: UpdateObjectTypeDto) {
    const objectType = (await this.getObjectType(id)).objectType;
    if (dto.categoryId !== undefined) {
      await this.checkCategory(dto.categoryId);
      objectType.categoryId = dto.categoryId;
    }
    if (dto.name !== undefined) objectType.name = dto.name;
    // Setting both the id and the relation would let the relation win: the loaded one is dropped.
    delete (objectType as Partial<ObjectType>).category;
    return { objectType: await this.objectTypes.save(objectType) };
  }

  async removeObjectType(id: number): Promise<void> {
    await this.getObjectType(id);
    await this.guarded(() => this.objectTypes.delete(id), 'object type');
  }

  // ---------- places
  async listPlaces() {
    return { places: await this.places.find({ order: { name: 'ASC' } }) };
  }

  async getPlace(id: number) {
    const place = await this.places.findOneBy({ id });
    if (!place) throw new NotFoundException('Place not found.');
    return { place };
  }

  async createPlace(dto: PlaceDto) {
    const place = await this.guarded(
      () =>
        this.places.save(
          this.places.create({
            name: dto.name,
            building: dto.building ?? null,
            floor: dto.floor ?? null,
            isActive: dto.isActive ?? true,
          }),
        ),
      'place',
    );
    return { place };
  }

  // PUT: the fields that are sent replace the old values, the others are kept.
  async updatePlace(id: number, dto: UpdatePlaceDto) {
    const place = (await this.getPlace(id)).place;
    if (dto.name !== undefined) place.name = dto.name;
    if (dto.building !== undefined) place.building = dto.building;
    if (dto.floor !== undefined) place.floor = dto.floor;
    if (dto.isActive !== undefined) place.isActive = dto.isActive;
    return { place: await this.guarded(() => this.places.save(place), 'place') };
  }

  async removePlace(id: number): Promise<void> {
    await this.getPlace(id);
    await this.guarded(() => this.places.delete(id), 'place');
  }
}
