import { ConflictException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../common/testing/http-test-app';
import { CategoriesController, ObjectTypesController, PlacesController } from './reference-crud.controllers';
import { ReferenceCrudService } from './reference-crud.service';

// Lab 6: the routes of the three reference entities, through real HTTP requests.
describe('Reference data controllers (HTTP)', () => {
  let app: INestApplication;
  const service = {
    listCategories: jest.fn(),
    getCategory: jest.fn(),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    removeCategory: jest.fn(),
    listObjectTypes: jest.fn(),
    getObjectType: jest.fn(),
    createObjectType: jest.fn(),
    updateObjectType: jest.fn(),
    removeObjectType: jest.fn(),
    listPlaces: jest.fn(),
    getPlace: jest.fn(),
    createPlace: jest.fn(),
    updatePlace: jest.fn(),
    removePlace: jest.fn(),
  };
  const http = () => request(app.getHttpServer());
  const admin = { 'x-user-id': '1', 'x-admin': 'yes' };

  beforeAll(async () => {
    app = await createHttpTestApp(
      [CategoriesController, ObjectTypesController, PlacesController],
      [{ provide: ReferenceCrudService, useValue: service }],
    );
  });
  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  describe('/api/categories', () => {
    it('GET is public', async () => {
      service.listCategories.mockResolvedValue({ categories: [{ id: 1 }] });
      service.getCategory.mockResolvedValue({ category: { id: 1 } });
      expect((await http().get('/api/categories')).status).toBe(200);
      expect((await http().get('/api/categories/1')).status).toBe(200);
      expect(service.getCategory).toHaveBeenCalledWith(1);
    });

    it('POST, PUT and DELETE need an administrator', async () => {
      expect((await http().post('/api/categories').send({ name: 'Keys' })).status).toBe(401);
      expect((await http().post('/api/categories').set('x-user-id', '5').send({ name: 'Keys' })).status).toBe(403);
      expect((await http().put('/api/categories/1').set('x-user-id', '5').send({ name: 'Keys' })).status).toBe(403);
      expect((await http().delete('/api/categories/1').set('x-user-id', '5')).status).toBe(403);
      expect(service.createCategory).not.toHaveBeenCalled();
    });

    it('POST creates, PUT renames and DELETE answers 204', async () => {
      service.createCategory.mockResolvedValue({ category: { id: 3, name: 'Keys' } });
      service.updateCategory.mockResolvedValue({ category: { id: 3, name: 'Badges' } });
      service.removeCategory.mockResolvedValue(undefined);

      const created = await http().post('/api/categories').set(admin).send({ name: ' Keys ' });
      expect(created.status).toBe(201);
      expect(service.createCategory).toHaveBeenCalledWith({ name: 'Keys' });

      expect((await http().put('/api/categories/3').set(admin).send({ name: 'Badges' })).status).toBe(200);
      const removed = await http().delete('/api/categories/3').set(admin);
      expect(removed.status).toBe(204);
      expect(removed.text).toBe('');
    });

    it('validates the name and reports a conflict', async () => {
      const empty = await http().post('/api/categories').set(admin).send({ name: '' });
      expect(empty.status).toBe(400);
      expect(empty.body.error).toBe('Enter a name.');

      const tooLong = await http().post('/api/categories').set(admin).send({ name: 'x'.repeat(61) });
      expect(tooLong.body.error).toBe('The name cannot be more than 60 characters.');

      service.createCategory.mockRejectedValue(new ConflictException('This category already exists.'));
      const duplicate = await http().post('/api/categories').set(admin).send({ name: 'Bags' });
      expect(duplicate.status).toBe(409);
    });
  });

  describe('/api/object-types', () => {
    it('GET lists them, with an optional category filter', async () => {
      service.listObjectTypes.mockResolvedValue({ objectTypes: [] });
      await http().get('/api/object-types');
      expect(service.listObjectTypes).toHaveBeenLastCalledWith(undefined);
      await http().get('/api/object-types?categoryId=2');
      expect(service.listObjectTypes).toHaveBeenLastCalledWith(2);
      await http().get('/api/object-types?categoryId=abc');
      expect(service.listObjectTypes).toHaveBeenLastCalledWith(undefined);
    });

    it('GET /:id, POST, PUT and DELETE', async () => {
      service.getObjectType.mockResolvedValue({ objectType: { id: 1 } });
      service.createObjectType.mockResolvedValue({ objectType: { id: 2 } });
      service.updateObjectType.mockResolvedValue({ objectType: { id: 2 } });
      service.removeObjectType.mockResolvedValue(undefined);

      expect((await http().get('/api/object-types/1')).status).toBe(200);
      expect((await http().post('/api/object-types').set(admin).send({ categoryId: 1, name: 'Phone' })).status).toBe(201);
      expect((await http().put('/api/object-types/2').set(admin).send({ categoryId: 1, name: 'Laptop' })).status).toBe(200);
      expect((await http().delete('/api/object-types/2').set(admin)).status).toBe(204);
      expect((await http().delete('/api/object-types/2').set('x-user-id', '5')).status).toBe(403);
    });

    it('POST refuses a missing category', async () => {
      const res = await http().post('/api/object-types').set(admin).send({ name: 'Phone' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Choose a category.');
    });
  });

  describe('/api/places', () => {
    it('GET lists the places and reads one', async () => {
      service.listPlaces.mockResolvedValue({ places: [] });
      service.getPlace.mockResolvedValue({ place: { id: 1 } });
      expect((await http().get('/api/places')).status).toBe(200);
      expect((await http().get('/api/places/1')).status).toBe(200);
    });

    it('POST, PUT and DELETE need an administrator and work for one', async () => {
      service.createPlace.mockResolvedValue({ place: { id: 2 } });
      service.updatePlace.mockResolvedValue({ place: { id: 2 } });
      service.removePlace.mockResolvedValue(undefined);

      expect((await http().post('/api/places').set('x-user-id', '5').send({ name: 'Hall' })).status).toBe(403);
      const created = await http().post('/api/places').set(admin).send({ name: 'Hall', building: 'A', floor: '1', isActive: true });
      expect(created.status).toBe(201);
      expect(service.createPlace).toHaveBeenCalledWith({ name: 'Hall', building: 'A', floor: '1', isActive: true });
      expect((await http().put('/api/places/2').set(admin).send({ name: 'Hall', isActive: false })).status).toBe(200);
      expect((await http().delete('/api/places/2').set(admin)).status).toBe(204);
    });

    it('POST refuses a value that is not a boolean and an empty name', async () => {
      const notBoolean = await http().post('/api/places').set(admin).send({ name: 'Hall', isActive: 'yes' });
      expect(notBoolean.status).toBe(400);
      expect(notBoolean.body.error).toBe('isActive must be true or false.');
      expect((await http().post('/api/places').set(admin).send({ name: ' ' })).status).toBe(400);
    });
  });
});
