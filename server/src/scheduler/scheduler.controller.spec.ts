import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../common/testing/http-test-app';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';

describe('SchedulerController (HTTP, SCRUM-51)', () => {
  let app: INestApplication;
  const service = { run: jest.fn() };
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createHttpTestApp([SchedulerController], [{ provide: SchedulerService, useValue: service }]);
  });
  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  it('POST /api/admin/scheduler/run needs a sign-in and an administrator', async () => {
    expect((await http().post('/api/admin/scheduler/run')).status).toBe(401);
    expect((await http().post('/api/admin/scheduler/run').set('x-user-id', '5')).status).toBe(403);
    expect(service.run).not.toHaveBeenCalled();
  });

  it('POST /api/admin/scheduler/run runs the job and answers 200 with the counts', async () => {
    service.run.mockResolvedValue({ archived: 2, reminded: 1 });
    const res = await http().post('/api/admin/scheduler/run').set('x-user-id', '1').set('x-admin', 'yes');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ archived: 2, reminded: 1 });
  });
});
