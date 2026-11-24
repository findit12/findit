import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../common/testing/http-test-app';
import { ReferenceController } from './reference.controller';
import { ReferenceService } from './reference.service';

// GET /api/reference-data: the lists used by the forms, public.
describe('ReferenceController (HTTP)', () => {
  let app: INestApplication;
  const service = { getAll: jest.fn() };

  beforeAll(async () => {
    app = await createHttpTestApp([ReferenceController], [{ provide: ReferenceService, useValue: service }]);
  });
  afterAll(() => app.close());

  it('GET /api/reference-data gives the categories and the places without sign-in', async () => {
    service.getAll.mockResolvedValue({ categories: [{ id: 1, name: 'Bags', objectTypes: [] }], places: [{ id: 1, name: 'Hall' }] });
    const res = await request(app.getHttpServer()).get('/api/reference-data');
    expect(res.status).toBe(200);
    expect(res.body.categories[0].name).toBe('Bags');
    expect(res.body.places).toHaveLength(1);
  });
});
