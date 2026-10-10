import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Category } from './category.entity';
import { ObjectType } from './object-type.entity';
import { Place } from './place.entity';
import { ReferenceService } from './reference.service';
import { SEED_CATEGORIES, SEED_PLACES } from './reference.seed';

// A fake repository: "create" returns what it receives, "save" returns it with an id.
function fakeRepository() {
  return {
    find: jest.fn(),
    findOneBy: jest.fn(),
    count: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn((data) => Promise.resolve(Array.isArray(data) ? data : { id: 1, ...data })),
  };
}

describe('ReferenceService', () => {
  let service: ReferenceService;
  let categories: ReturnType<typeof fakeRepository>;
  let objectTypes: ReturnType<typeof fakeRepository>;
  let places: ReturnType<typeof fakeRepository>;

  beforeEach(async () => {
    categories = fakeRepository();
    objectTypes = fakeRepository();
    places = fakeRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferenceService,
        { provide: getRepositoryToken(Category), useValue: categories },
        { provide: getRepositoryToken(ObjectType), useValue: objectTypes },
        { provide: getRepositoryToken(Place), useValue: places },
      ],
    }).compile();

    service = module.get(ReferenceService);
  });

  it('returns the categories with their precise objects, and the places', async () => {
    categories.find.mockResolvedValue([
      { id: 1, name: 'Electronics', objectTypes: [{ id: 4, name: 'Phone', categoryId: 1 }] },
    ]);
    places.find.mockResolvedValue([{ id: 2, name: 'Library', isActive: true }]);

    await expect(service.getAll()).resolves.toEqual({
      categories: [{ id: 1, name: 'Electronics', objectTypes: [{ id: 4, name: 'Phone' }] }],
      places: [{ id: 2, name: 'Library' }],
    });
  });

  describe('checkSelection', () => {
    it('accepts a precise object of the chosen category and an active place', async () => {
      objectTypes.findOneBy.mockResolvedValue({ id: 4, categoryId: 1 });
      places.findOneBy.mockResolvedValue({ id: 2 });
      await expect(service.checkSelection(1, 4, 2)).resolves.toBeUndefined();
    });

    it('refuses a precise object from another category', async () => {
      objectTypes.findOneBy.mockResolvedValue({ id: 4, categoryId: 3 });
      await expect(service.checkSelection(1, 4, 2)).rejects.toThrow(BadRequestException);
    });

    it('refuses an unknown place', async () => {
      objectTypes.findOneBy.mockResolvedValue({ id: 4, categoryId: 1 });
      places.findOneBy.mockResolvedValue(null);
      await expect(service.checkSelection(1, 4, 99)).rejects.toThrow('Choose a place from the list.');
    });
  });

  describe('seedIfEmpty', () => {
    it('fills empty tables with the starting lists', async () => {
      categories.count.mockResolvedValue(0);
      places.count.mockResolvedValue(0);

      await service.seedIfEmpty();

      expect(categories.save).toHaveBeenCalledTimes(Object.keys(SEED_CATEGORIES).length);
      expect(places.save.mock.calls[0][0]).toHaveLength(SEED_PLACES.length);
    });

    it('does nothing when the tables already have data', async () => {
      categories.count.mockResolvedValue(7);
      places.count.mockResolvedValue(10);

      await service.seedIfEmpty();

      expect(categories.save).not.toHaveBeenCalled();
      expect(places.save).not.toHaveBeenCalled();
    });
  });
});
