import { ConflictException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../common/testing/http-test-app';
import { AdminReportsController } from './admin-reports.controller';
import { AnnouncementReportsController } from './announcement-reports.controller';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

// Lab 6: every route of /api/reports for a student, and the route that already existed under announcements.
describe('ReportsController (HTTP)', () => {
  let app: INestApplication;
  const service = {
    createReport: jest.fn(),
    listMine: jest.fn(),
    getMine: jest.fn(),
    updateMine: jest.fn(),
    removeMine: jest.fn(),
    dismissReport: jest.fn(),
  };
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createHttpTestApp(
      [ReportsController, AnnouncementReportsController, AdminReportsController],
      [{ provide: ReportsService, useValue: service }],
    );
  });
  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  it('refuses a request without sign-in', async () => {
    expect((await http().get('/api/reports')).status).toBe(401);
  });

  it('POST /api/reports reports the announcement written in the body', async () => {
    service.createReport.mockResolvedValue({ id: 4, announcementId: 7, status: 'pending' });
    const res = await http().post('/api/reports').set('x-user-id', '2').send({ announcementId: 7, reason: ' Spam ' });
    expect(res.status).toBe(201);
    expect(service.createReport).toHaveBeenCalledWith(7, 2, expect.objectContaining({ reason: 'Spam' }));
  });

  it('POST /api/reports refuses a missing reason or announcement', async () => {
    const noReason = await http().post('/api/reports').set('x-user-id', '2').send({ announcementId: 7, reason: ' ' });
    expect(noReason.status).toBe(400);
    expect(noReason.body.error).toBe('Enter a reason for reporting this announcement.');

    const noAnnouncement = await http().post('/api/reports').set('x-user-id', '2').send({ reason: 'Spam' });
    expect(noAnnouncement.status).toBe(400);
    expect(noAnnouncement.body.error).toBe('Choose an announcement.');
  });

  it('POST /api/announcements/:id/reports still works', async () => {
    service.createReport.mockResolvedValue({ id: 5 });
    const res = await http().post('/api/announcements/7/reports').set('x-user-id', '2').send({ reason: 'Spam' });
    expect(res.status).toBe(201);
    expect(service.createReport).toHaveBeenCalledWith(7, 2, expect.objectContaining({ reason: 'Spam' }));
  });

  it('GET /api/reports lists my reports and GET /api/reports/:id reads one', async () => {
    service.listMine.mockResolvedValue({ reports: [{ id: 4 }] });
    service.getMine.mockResolvedValue({ report: { id: 4 } });
    expect((await http().get('/api/reports').set('x-user-id', '2')).body.reports).toHaveLength(1);
    expect((await http().get('/api/reports/4').set('x-user-id', '2')).status).toBe(200);
    expect(service.getMine).toHaveBeenCalledWith(4, 2);
  });

  it('PUT /api/reports/:id changes the reason', async () => {
    service.updateMine.mockResolvedValue({ report: { id: 4, reason: 'New' } });
    const res = await http().put('/api/reports/4').set('x-user-id', '2').send({ reason: 'New' });
    expect(res.status).toBe(200);
    expect(service.updateMine).toHaveBeenCalledWith(4, 2, { reason: 'New' });
  });

  it('PUT /api/reports/:id answers 409 when the report was handled', async () => {
    service.updateMine.mockRejectedValue(new ConflictException('This report has already been handled.'));
    const res = await http().put('/api/reports/4').set('x-user-id', '2').send({ reason: 'New' });
    expect(res.status).toBe(409);
  });

  it('DELETE /api/reports/:id withdraws a report with a 204', async () => {
    service.removeMine.mockResolvedValue(undefined);
    const res = await http().delete('/api/reports/4').set('x-user-id', '2');
    expect(res.status).toBe(204);
    expect(service.removeMine).toHaveBeenCalledWith(4, 2);
  });

  it('keeps the administrator routes apart: DELETE /api/reports/admin/:id needs an administrator', async () => {
    const refused = await http().delete('/api/reports/admin/4').set('x-user-id', '2');
    expect(refused.status).toBe(403);
    expect(service.removeMine).not.toHaveBeenCalled();

    service.dismissReport.mockResolvedValue({ id: 4, status: 'dismissed' });
    const ok = await http().delete('/api/reports/admin/4').set('x-user-id', '1').set('x-admin', 'yes');
    expect(ok.status).toBe(200);
    expect(service.dismissReport).toHaveBeenCalledWith(4);
  });
});
