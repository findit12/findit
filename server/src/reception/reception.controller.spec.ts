import { ConflictException } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../common/testing/http-test-app';
import { ReceptionController } from './reception.controller';
import { ReceptionService } from './reception.service';

describe('ReceptionController (HTTP, SCRUM-52)', () => {
  let app: INestApplication;
  const service = { dropOff: jest.fn() };
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createHttpTestApp([ReceptionController], [{ provide: ReceptionService, useValue: service }]);
  });
  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  it('POST /api/announcements/:id/drop-off needs a sign-in (401)', async () => {
    expect((await http().post('/api/announcements/8/drop-off')).status).toBe(401);
  });

  it('POST /api/announcements/:id/drop-off answers 200 with the result', async () => {
    service.dropOff.mockResolvedValue({ announcementId: 8, currentLocation: 'reception', closedDiscussions: 1 });
    const res = await http().post('/api/announcements/8/drop-off').set('x-user-id', '5');
    expect(res.status).toBe(200);
    expect(res.body.currentLocation).toBe('reception');
    expect(service.dropOff).toHaveBeenCalledWith(5, 8);
  });

  it('rejects an id that is not a number (400)', async () => {
    expect((await http().post('/api/announcements/abc/drop-off').set('x-user-id', '5')).status).toBe(400);
  });

  it('shows the error of the service in the { error } format (409)', async () => {
    service.dropOff.mockRejectedValue(new ConflictException('This object is already at the reception.'));
    const res = await http().post('/api/announcements/8/drop-off').set('x-user-id', '5');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'This object is already at the reception.' });
  });
});
