import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';
import { AllExceptionsFilter } from '../common/filters/http-exception.filter';

describe('AuthController (HTTP)', () => {
  let app: INestApplication;
  const mockAuthService = {
    register: jest.fn().mockResolvedValue({
      user: { id: 1, email: 'student@school.edu', is_verified: false },
    }),
    verify: jest.fn().mockResolvedValue({ message: 'Your account has been verified.' }),
    resend: jest.fn().mockResolvedValue({
      message: 'If an unverified account exists, a verification email has been sent.',
    }),
    login: jest.fn().mockResolvedValue({
      token: 'jwt.token.val',
      user: { id: 1, email: 'student@school.edu', isVerified: true },
    }),
    forgot: jest.fn().mockResolvedValue({
      message: 'If an account exists for that email, a reset link has been sent.',
    }),
    reset: jest.fn().mockResolvedValue({
      message: 'Your password has been reset. You can now log in.',
    }),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // A valid registration form (FR-01).
  const registration = {
    email: 'student@school.edu',
    password: 'Password123',
    firstName: 'Elea',
    lastName: 'Schom',
    gdprConsent: true,
  };

  it('POST /api/auth/register returns 201 and user object', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(registration)
      .expect(201);

    expect(res.body).toEqual({
      user: { id: 1, email: 'student@school.edu', is_verified: false },
    });
  });

  it('POST /api/auth/register refuses a form without the GDPR consent or the names (TC-AUTH-01)', async () => {
    const withoutConsent = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...registration, gdprConsent: false })
      .expect(400);
    expect(withoutConsent.body.error).toBe('You must accept the privacy policy to create an account.');

    const withoutName = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...registration, firstName: '   ' })
      .expect(400);
    expect(withoutName.body.error).toBe('Enter your first name.');
  });

  it('GET /api/auth/verify returns 200 and message', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/verify?token=sampletoken')
      .expect(200);

    expect(res.body).toEqual({ message: 'Your account has been verified.' });
  });

  it('POST /api/auth/login returns 200 and token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'student@school.edu', password: 'Password123' })
      .expect(200);

    expect(res.body).toEqual({
      token: 'jwt.token.val',
      user: { id: 1, email: 'student@school.edu', isVerified: true },
    });
  });

  it('POST /api/auth/logout returns 204', async () => {
    await request(app.getHttpServer()).post('/api/auth/logout').expect(204);
  });
});