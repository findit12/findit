import { ConflictException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../common/testing/http-test-app';
import { AdminClaimsController } from './admin-claims.controller';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';

describe('Claims routes (HTTP, SCRUM-53)', () => {
  let app: INestApplication;
  const service = {
    create: jest.fn(),
    findMine: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    listPending: jest.fn(),
    confirm: jest.fn(),
    decline: jest.fn(),
  };
  const http = () => request(app.getHttpServer());
  const asUser = (r: request.Test) => r.set('x-user-id', '9');
  const asAdmin = (r: request.Test) => r.set('x-user-id', '1').set('x-admin', 'yes');

  beforeAll(async () => {
    app = await createHttpTestApp([ClaimsController, AdminClaimsController], [{ provide: ClaimsService, useValue: service }]);
  });
  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  it('every claim route needs a sign-in (401)', async () => {
    expect((await http().post('/api/announcements/8/claims').send({ proof: 'x' })).status).toBe(401);
    expect((await http().get('/api/claims')).status).toBe(401);
    expect((await http().get('/api/claims/1')).status).toBe(401);
    expect((await http().put('/api/claims/1').send({})).status).toBe(401);
    expect((await http().delete('/api/claims/1')).status).toBe(401);
  });

  it('POST /api/announcements/:id/claims answers 201 with the claim', async () => {
    service.create.mockResolvedValue({ claim: { id: 1, status: 'pending' } });
    const res = await asUser(http().post('/api/announcements/8/claims')).send({ proof: '  A cat sticker  ' });
    expect(res.status).toBe(201);
    expect(res.body.claim.id).toBe(1);
    expect(service.create).toHaveBeenCalledWith(9, 8, { proof: 'A cat sticker' });
  });

  it('rejects an empty proof, an unknown field and a wrong id (400)', async () => {
    const empty = await asUser(http().post('/api/announcements/8/claims')).send({ proof: '   ' });
    expect(empty.status).toBe(400);
    expect(empty.body.error).toContain('Describe the hidden detail');
    expect((await asUser(http().post('/api/announcements/8/claims')).send({ proof: 'x', status: 'accepted' })).status).toBe(400);
    expect((await asUser(http().post('/api/announcements/abc/claims')).send({ proof: 'x' })).status).toBe(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('shows a 409 of the service in the { error } format', async () => {
    service.create.mockRejectedValue(new ConflictException('This object is not at the reception desk.'));
    const res = await asUser(http().post('/api/announcements/8/claims')).send({ proof: 'x' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'This object is not at the reception desk.' });
  });

  it('GET /api/claims and GET /api/claims/:id', async () => {
    service.findMine.mockResolvedValue({ claims: [] });
    service.findOne.mockResolvedValue({ claim: { id: 1 } });
    expect((await asUser(http().get('/api/claims'))).body).toEqual({ claims: [] });
    expect((await asUser(http().get('/api/claims/1'))).body).toEqual({ claim: { id: 1 } });
    expect(service.findOne).toHaveBeenCalledWith(9, 1);
  });

  it('PUT /api/claims/:id sends the (partial) body, DELETE answers 204', async () => {
    service.update.mockResolvedValue({ claim: { id: 1 } });
    service.remove.mockResolvedValue(undefined);
    expect((await asUser(http().put('/api/claims/1')).send({ proof: 'New proof' })).status).toBe(200);
    expect(service.update).toHaveBeenCalledWith(9, 1, { proof: 'New proof' });
    expect((await asUser(http().put('/api/claims/1')).send({})).status).toBe(200);
    expect((await asUser(http().delete('/api/claims/1'))).status).toBe(204);
  });

  it('admin routes: 401 without sign-in, 403 for a student', async () => {
    expect((await http().get('/api/admin/claims')).status).toBe(401);
    expect((await asUser(http().get('/api/admin/claims'))).status).toBe(403);
    expect((await asUser(http().post('/api/admin/claims/1/confirm-handover'))).status).toBe(403);
    expect((await asUser(http().post('/api/admin/claims/1/decline'))).status).toBe(403);
    expect(service.listPending).not.toHaveBeenCalled();
  });

  it('admin routes: list, confirm-handover and decline answer 200', async () => {
    service.listPending.mockResolvedValue({ claims: [{ id: 1 }] });
    service.confirm.mockResolvedValue({ claimId: 1 });
    service.decline.mockResolvedValue({ claimId: 1 });
    expect((await asAdmin(http().get('/api/admin/claims'))).body).toEqual({ claims: [{ id: 1 }] });
    expect((await asAdmin(http().post('/api/admin/claims/1/confirm-handover'))).status).toBe(200);
    expect(service.confirm).toHaveBeenCalledWith(1, 1);
    expect((await asAdmin(http().post('/api/admin/claims/1/decline'))).status).toBe(200);
    expect(service.decline).toHaveBeenCalledWith(1, 1);
  });
});
