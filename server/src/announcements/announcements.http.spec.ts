import { ForbiddenException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../common/testing/http-test-app';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

// Lab 6: every route of /api/announcements, through real HTTP requests.
describe('AnnouncementsController (HTTP)', () => {
  let app: INestApplication;
  const service = {
    create: jest.fn(),
    findPublic: jest.fn(),
    findPublicPage: jest.fn(),
    findMine: jest.fn(),
    findMineById: jest.fn(),
    findPublicMatches: jest.fn(),
    update: jest.fn(),
    replace: jest.fn(),
    remove: jest.fn(),
    getAdminStatistics: jest.fn(),
  };
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createHttpTestApp([AnnouncementsController], [{ provide: AnnouncementsService, useValue: service }]);
  });
  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  it('GET /api/announcements/:id is public', async () => {
    service.findPublic.mockResolvedValue({ announcement: { id: 7 } });
    const res = await http().get('/api/announcements/7');
    expect(res.status).toBe(200);
    expect(service.findPublic).toHaveBeenCalledWith(7);
  });

  it('GET /api/announcements/abc answers 400', async () => {
    expect((await http().get('/api/announcements/abc')).status).toBe(400);
  });

  it('GET /api/announcements/mine needs a sign-in and lists my announcements', async () => {
    expect((await http().get('/api/announcements/mine')).status).toBe(401);
    service.findMine.mockResolvedValue({ announcements: [] });
    const res = await http().get('/api/announcements/mine').set('x-user-id', '5');
    expect(res.status).toBe(200);
    expect(service.findMine).toHaveBeenCalledWith(5);
  });

  // The full form of a PUT: the six required fields (the optional text fields are emptied when missing).
  const fullForm = {
    title: 'Black iPhone 13',
    categoryId: 1,
    objectTypeId: 2,
    description: 'Found under a table',
    eventDate: '2026-10-01',
    placeId: 3,
  };

  it('PATCH changes only the fields that are sent', async () => {
    service.update.mockResolvedValue({ announcement: { id: 7, title: 'New title' } });
    const res = await http().patch('/api/announcements/7').set('x-user-id', '5').send({ title: 'New title' });
    expect(res.status).toBe(200);
    expect(service.update).toHaveBeenCalledWith(5, 7, expect.objectContaining({ title: 'New title' }));
  });

  it('PUT /api/announcements/:id replaces the announcement with the full form', async () => {
    service.replace.mockResolvedValue({ announcement: { id: 7, title: 'Black iPhone 13' } });
    const res = await http().put('/api/announcements/7').set('x-user-id', '5').send(fullForm);
    expect(res.status).toBe(200);
    expect(service.replace).toHaveBeenCalledWith(5, 7, expect.objectContaining({ title: 'Black iPhone 13', placeId: 3 }));
  });

  it('PUT /api/announcements/:id refuses a missing required field, a field that does not exist and a status', async () => {
    const missing = await http().put('/api/announcements/7').set('x-user-id', '5').send({ title: 'Only a title' });
    expect(missing.status).toBe(400);
    const unknown = await http().put('/api/announcements/7').set('x-user-id', '5').send({ ...fullForm, owner: 1 });
    expect(unknown.status).toBe(400);
    const status = await http().put('/api/announcements/7').set('x-user-id', '5').send({ ...fullForm, status: 'Returned' });
    expect(status.status).toBe(400);
    expect(service.replace).not.toHaveBeenCalled();
  });

  it('PUT /api/announcements/:id answers 401 without sign-in and 403 for someone else\'s announcement', async () => {
    expect((await http().put('/api/announcements/7').send(fullForm)).status).toBe(401);
    service.replace.mockRejectedValue(new ForbiddenException('You can only edit your own announcements.'));
    const res = await http().put('/api/announcements/7').set('x-user-id', '6').send(fullForm);
    expect(res.status).toBe(403);
  });

  it('DELETE /api/announcements/:id answers 204 with no body', async () => {
    service.remove.mockResolvedValue(undefined);
    const res = await http().delete('/api/announcements/7').set('x-user-id', '5');
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(service.remove).toHaveBeenCalledWith(5, 7);
  });

  it('POST /api/announcements needs a sign-in and refuses an incomplete form', async () => {
    expect((await http().post('/api/announcements').field('title', 'x')).status).toBe(401);
    const res = await http().post('/api/announcements').set('x-user-id', '5').field('title', 'Black phone');
    expect(res.status).toBe(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('GET /api/announcements/admin/statistics is not captured by ":id"', async () => {
    service.getAdminStatistics.mockResolvedValue({ declaredCount: 10 });
    const res = await http().get('/api/announcements/admin/statistics').set('x-user-id', '1').set('x-admin', 'yes');
    expect(res.status).toBe(200);
    expect(res.body.declaredCount).toBe(10);
  });
});
