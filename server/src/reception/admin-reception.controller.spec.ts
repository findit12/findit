import { BadRequestException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../common/testing/http-test-app';
import { AdminReceptionController } from './admin-reception.controller';
import { ReceptionDeclarationService } from './reception-declaration.service';

describe('AdminReceptionController (HTTP, SCRUM-54)', () => {
  let app: INestApplication;
  const service = { declare: jest.fn() };
  const http = () => request(app.getHttpServer());
  const staff = (r: request.Test) => r.set('x-user-id', '1').set('x-admin', 'yes');
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

  beforeAll(async () => {
    app = await createHttpTestApp([AdminReceptionController], [{ provide: ReceptionDeclarationService, useValue: service }]);
  });
  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  it('POST /api/admin/announcements: 401 without sign-in, 403 for a student', async () => {
    expect((await http().post('/api/admin/announcements')).status).toBe(401);
    expect((await http().post('/api/admin/announcements').set('x-user-id', '5')).status).toBe(403);
    expect(service.declare).not.toHaveBeenCalled();
  });

  it('answers 201 and sends the photos and the hidden detail to the service', async () => {
    service.declare.mockResolvedValue({ announcement: { id: 30 }, matchCount: 0 });
    const res = await staff(http().post('/api/admin/announcements'))
      .field('hiddenDetail', '  Cat sticker ')
      .attach('photos', jpeg, { filename: 'p.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.announcement.id).toBe(30);
    const [adminId, dto, files] = service.declare.mock.calls[0];
    expect(adminId).toBe(1);
    expect(dto.hiddenDetail).toBe('Cat sticker');
    expect(files).toHaveLength(1);
  });

  it('refuses a field that is not part of the reduced form (400)', async () => {
    const res = await staff(http().post('/api/admin/announcements'))
      .field('title', 'My own title')
      .attach('photos', jpeg, { filename: 'p.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(service.declare).not.toHaveBeenCalled();
  });

  it('shows the error of the service in the { error } format (no photo)', async () => {
    service.declare.mockRejectedValue(new BadRequestException('Add at least one photo.'));
    const res = await staff(http().post('/api/admin/announcements'));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Add at least one photo.' });
  });
});
