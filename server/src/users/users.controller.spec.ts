import { ForbiddenException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthService } from '../auth/auth.service';
import { createHttpTestApp } from '../common/testing/http-test-app';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// Lab 6: every route of /api/users, through real HTTP requests.
describe('UsersController (HTTP)', () => {
  let app: INestApplication;
  const service = { findAll: jest.fn(), findOne: jest.fn(), update: jest.fn(), remove: jest.fn() };
  const auth = { register: jest.fn() };
  const user = { id: 5, email: 'sam@school.test', firstName: 'Sam', lastName: 'Martin' };

  beforeAll(async () => {
    app = await createHttpTestApp(
      [UsersController],
      [
        { provide: UsersService, useValue: service },
        { provide: AuthService, useValue: auth },
      ],
    );
  });
  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  it('POST /api/users registers an account without sign-in', async () => {
    auth.register.mockResolvedValue({ user: { id: 6 } });
    const res = await request(app.getHttpServer()).post('/api/users').send({
      email: 'new@school.test',
      password: 'Password123',
      firstName: 'New',
      lastName: 'Student',
      gdprConsent: true,
    });
    expect(res.status).toBe(201);
    expect(auth.register).toHaveBeenCalledTimes(1);
  });

  it('POST /api/users refuses an incomplete form', async () => {
    const res = await request(app.getHttpServer()).post('/api/users').send({ email: 'new@school.test' });
    expect(res.status).toBe(400);
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('GET /api/users is for administrators only', async () => {
    const refused = await request(app.getHttpServer()).get('/api/users').set('x-user-id', '5');
    expect(refused.status).toBe(403);

    service.findAll.mockResolvedValue({ users: [user] });
    const res = await request(app.getHttpServer()).get('/api/users').set('x-user-id', '1').set('x-admin', 'yes');
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
  });

  it('GET /api/users/:id reads an account', async () => {
    service.findOne.mockResolvedValue({ user });
    const res = await request(app.getHttpServer()).get('/api/users/5').set('x-user-id', '5');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('sam@school.test');
    expect(service.findOne).toHaveBeenCalledWith(5, 5);
  });

  it('GET /api/users/:id answers 403 for the account of someone else', async () => {
    service.findOne.mockRejectedValue(new ForbiddenException('You can only use your own account.'));
    const res = await request(app.getHttpServer()).get('/api/users/6').set('x-user-id', '5');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('You can only use your own account.');
  });

  it('GET /api/users/:id answers 401 without sign-in', async () => {
    const res = await request(app.getHttpServer()).get('/api/users/5');
    expect(res.status).toBe(401);
  });

  it('PUT /api/users/:id changes the names', async () => {
    service.update.mockResolvedValue({ user: { ...user, firstName: 'Samuel' } });
    const res = await request(app.getHttpServer())
      .put('/api/users/5')
      .set('x-user-id', '5')
      .send({ firstName: ' Samuel ', lastName: 'Martin' });
    expect(res.status).toBe(200);
    expect(service.update).toHaveBeenCalledWith(5, 5, { firstName: 'Samuel', lastName: 'Martin' });
  });

  it('PUT /api/users/:id refuses an empty name and a field that cannot be changed', async () => {
    const empty = await request(app.getHttpServer())
      .put('/api/users/5')
      .set('x-user-id', '5')
      .send({ firstName: '  ', lastName: 'Martin' });
    expect(empty.status).toBe(400);
    expect(empty.body.error).toBe('Enter your first name.');

    const role = await request(app.getHttpServer())
      .put('/api/users/5')
      .set('x-user-id', '5')
      .send({ firstName: 'Sam', lastName: 'Martin', role: 'admin' });
    expect(role.status).toBe(400);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('DELETE /api/users/:id answers 204 with no body', async () => {
    service.remove.mockResolvedValue(undefined);
    const res = await request(app.getHttpServer()).delete('/api/users/5').set('x-user-id', '5');
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(service.remove).toHaveBeenCalledWith(5, 5);
  });
});
