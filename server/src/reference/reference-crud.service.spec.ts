import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Category } from './category.entity';
import { ObjectType } from './object-type.entity';
import { Place } from './place.entity';
import { ReferenceCrudService } from './reference-crud.service';

// A PostgreSQL error, as TypeORM gives it (the code is in driverError).
const dbError = (code: string) => Object.assign(new Error('db'), { driverError: { code } });

describe('ReferenceCrudService', () => {
  let service: ReferenceCrudService;
  const categories = { find: jest.fn(), findOneBy: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn() };
  const objectTypes = { find: jest.fn(), findOneBy: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn() };
  const places = { find: jest.fn(), findOneBy: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn() };

  beforeEach(async () => {
    for (const repo of [categories, objectTypes, places]) {
      Object.values(repo).forEach((fn) => fn.mockReset());
      repo.create.mockImplementation((data) => data);
      repo.save.mockImplementation((data) => Promise.resolve({ id: 1, ...data }));
    }
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReferenceCrudService,
        { provide: getRepositoryToken(Category), useValue: categories },
        { provide: getRepositoryToken(ObjectType), useValue: objectTypes },
        { provide: getRepositoryToken(Place), useValue: places },
      ],
    }).compile();
    service = moduleRef.get(ReferenceCrudService);
  });

  describe('categories', () => {
    it('lists, reads, creates, renames and deletes', async () => {
      categories.find.mockResolvedValue([{ id: 1, name: 'Bags' }]);
      expect((await service.listCategories()).categories).toHaveLength(1);

      categories.findOneBy.mockResolvedValue({ id: 1, name: 'Bags' });
      expect((await service.getCategory(1)).category.name).toBe('Bags');
      expect((await service.createCategory({ name: 'Keys' })).category).toEqual({ id: 1, name: 'Keys' });
      expect((await service.updateCategory(1, { name: 'Luggage' })).category.name).toBe('Luggage');

      await service.removeCategory(1);
      expect(categories.delete).toHaveBeenCalledWith(1);
    });

    it('answers not found for an unknown category', async () => {
      categories.findOneBy.mockResolvedValue(null);
      await expect(service.getCategory(99)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.removeCategory(99)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('turns a duplicate name and a category still used into 409', async () => {
      categories.save.mockRejectedValue(dbError('23505'));
      await expect(service.createCategory({ name: 'Bags' })).rejects.toThrow('This category already exists.');

      categories.findOneBy.mockResolvedValue({ id: 1, name: 'Bags' });
      categories.delete.mockRejectedValue(dbError('23503'));
      await expect(service.removeCategory(1)).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not hide an error that is not a conflict', async () => {
      categories.save.mockRejectedValue(new Error('connection lost'));
      await expect(service.createCategory({ name: 'Bags' })).rejects.toThrow('connection lost');
    });
  });

  describe('object types', () => {
    it('lists all of them, or only the ones of a category', async () => {
      objectTypes.find.mockResolvedValue([]);
      await service.listObjectTypes();
      expect(objectTypes.find).toHaveBeenLastCalledWith({ where: {}, order: { name: 'ASC' } });
      await service.listObjectTypes(2);
      expect(objectTypes.find).toHaveBeenLastCalledWith({ where: { categoryId: 2 }, order: { name: 'ASC' } });
    });

    it('creates and replaces one inside an existing category', async () => {
      categories.findOneBy.mockResolvedValue({ id: 2 });
      expect((await service.createObjectType({ categoryId: 2, name: 'Phone' })).objectType).toMatchObject({ categoryId: 2, name: 'Phone' });

      objectTypes.findOneBy.mockResolvedValue({ id: 1, categoryId: 1, name: 'Phone', category: { id: 1 } });
      const { objectType } = await service.updateObjectType(1, { categoryId: 2, name: 'Laptop' });
      expect(objectType).toMatchObject({ categoryId: 2, name: 'Laptop' });
      expect(objectType).not.toHaveProperty('category');
    });

    it('refuses an unknown category', async () => {
      categories.findOneBy.mockResolvedValue(null);
      await expect(service.createObjectType({ categoryId: 9, name: 'Phone' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reads, deletes, and answers not found or 409', async () => {
      objectTypes.findOneBy.mockResolvedValue({ id: 1 });
      expect((await service.getObjectType(1)).objectType.id).toBe(1);
      await service.removeObjectType(1);
      expect(objectTypes.delete).toHaveBeenCalledWith(1);

      objectTypes.delete.mockRejectedValue(dbError('23503'));
      await expect(service.removeObjectType(1)).rejects.toThrow('This object type is still used, it cannot be deleted.');

      objectTypes.findOneBy.mockResolvedValue(null);
      await expect(service.getObjectType(99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('places', () => {
    it('creates an active place by default and keeps the building and floor', async () => {
      const { place } = await service.createPlace({ name: 'Library', building: 'A', floor: '2' });
      expect(place).toMatchObject({ name: 'Library', building: 'A', floor: '2', isActive: true });
      expect((await service.createPlace({ name: 'Hall' })).place).toMatchObject({ building: null, floor: null });
    });

    it('updates what is sent and keeps what is not sent (Lab 6 pattern)', async () => {
      places.findOneBy.mockResolvedValue({ id: 1, name: 'Hall', building: 'A', floor: '1', isActive: false });
      const { place } = await service.updatePlace(1, { name: 'Main hall' });
      expect(place).toMatchObject({ name: 'Main hall', building: 'A', floor: '1', isActive: false });
    });

    it('can switch a place off and on again with isActive', async () => {
      places.findOneBy.mockResolvedValue({ id: 1, name: 'Hall', building: null, floor: null, isActive: true });
      expect((await service.updatePlace(1, { isActive: false })).place).toMatchObject({ name: 'Hall', isActive: false });
    });

    it('lists, reads and deletes', async () => {
      places.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      expect((await service.listPlaces()).places).toHaveLength(2);
      places.findOneBy.mockResolvedValue({ id: 1 });
      expect((await service.getPlace(1)).place.id).toBe(1);
      await service.removePlace(1);
      expect(places.delete).toHaveBeenCalledWith(1);
    });

    it('answers not found, and 409 for a duplicate name or a place still used', async () => {
      places.findOneBy.mockResolvedValue(null);
      await expect(service.getPlace(99)).rejects.toBeInstanceOf(NotFoundException);

      places.save.mockRejectedValue(dbError('23505'));
      await expect(service.createPlace({ name: 'Hall' })).rejects.toBeInstanceOf(ConflictException);

      places.findOneBy.mockResolvedValue({ id: 1 });
      places.delete.mockRejectedValue(dbError('23503'));
      await expect(service.removePlace(1)).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
