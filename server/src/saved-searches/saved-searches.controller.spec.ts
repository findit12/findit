import { INestApplication, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../common/testing/http-test-app';
import { SavedSearchesController } from './saved-searches.controller';
import { SavedSearchesService } from './saved-searches.service';

// Lab 6: every route of /api/saved-searches, through real HTTP requests.
describe('SavedSearchesController (HTTP)', () => {
  let app: INestApplication;
  const service = {
    create: jest.fn(),
    findMine: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const saved = { id: 3, keyword: 'phone', categoryId: null };

  beforeAll(async () => {
    app = await createHttpTestApp([SavedSearchesController], [{ provide: SavedSearchesService, useValue: service }]);
  });
  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  it('GET /api/saved-searches lists my searches', async () => {
    service.findMine.mockResolvedValue({ savedSearches: [saved] });
    const res = await request(app.getHttpServer()).get('/api/saved-searches').set('x-user-id', '5');
    expect(res.status).toBe(200);
    expect(res.body.savedSearches).toHaveLength(1);
    expect(service.findMine).toHaveBeenCalledWith(5);
  });

  it('refuses a request without sign-in', async () => {
    const res = await request(app.getHttpServer()).get('/api/saved-searches');
    expect(res.status).toBe(401);
  });

  it('GET /api/saved-searches/:id reads one search', async () => {
    service.findOne.mockResolvedValue({ savedSearch: saved });
    const res = await request(app.getHttpServer()).get('/api/saved-searches/3').set('x-user-id', '5');
    expect(res.status).toBe(200);
    expect(res.body.savedSearch.id).toBe(3);
    expect(service.findOne).toHaveBeenCalledWith(5, 3);
  });

  it('GET /api/saved-searches/:id answers 404 for an unknown search', async () => {
    service.findOne.mockRejectedValue(new NotFoundException('Saved search not found.'));
    const res = await request(app.getHttpServer()).get('/api/saved-searches/99').set('x-user-id', '5');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Saved search not found.');
  });

  it('GET /api/saved-searches/abc answers 400 (the id must be a number)', async () => {
    const res = await request(app.getHttpServer()).get('/api/saved-searches/abc').set('x-user-id', '5');
    expect(res.status).toBe(400);
  });

  it('POST /api/saved-searches creates a search', async () => {
    service.create.mockResolvedValue({ savedSearch: saved });
    const res = await request(app.getHttpServer())
      .post('/api/saved-searches')
      .set('x-user-id', '5')
      .send({ q: 'phone', categoryId: 1 });
    expect(res.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(5, expect.objectContaining({ q: 'phone', categoryId: 1 }));
  });

  it('POST /api/saved-searches refuses a field that does not exist', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/saved-searches')
      .set('x-user-id', '5')
      .send({ q: 'phone', hacker: true });
    expect(res.status).toBe(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('PUT /api/saved-searches/:id updates a search', async () => {
    service.update.mockResolvedValue({ savedSearch: { ...saved, keyword: 'laptop' } });
    const res = await request(app.getHttpServer()).put('/api/saved-searches/3').set('x-user-id', '5').send({ q: 'laptop' });
    expect(res.status).toBe(200);
    expect(res.body.savedSearch.keyword).toBe('laptop');
    expect(service.update).toHaveBeenCalledWith(5, 3, expect.objectContaining({ q: 'laptop' }));
  });

  it('DELETE /api/saved-searches/:id answers 204 with no body', async () => {
    service.remove.mockResolvedValue(undefined);
    const res = await request(app.getHttpServer()).delete('/api/saved-searches/3').set('x-user-id', '5');
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(service.remove).toHaveBeenCalledWith(5, 3);
  });
});
