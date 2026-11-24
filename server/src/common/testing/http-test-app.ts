import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  Type,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminGuard } from '../../auth/admin.guard';
import { AuthenticatedRequest, JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AllExceptionsFilter } from '../filters/http-exception.filter';

// Tests of the routes through real HTTP requests (Supertest), as asked by Lab 6.
// The service behind the controller is replaced by a mock, so a test checks the route itself:
// the address, the method, the validation of the body, the status code and the error format.
//
// The sign-in is replaced too: a request with the header "x-user-id: 5" is the user 5, a request
// without it is refused with 401, like the real JwtAuthGuard does. The administrator guard accepts
// the header "x-admin: yes" and refuses with 403 otherwise.
const fakeJwtGuard: CanActivate = {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const id = Number(request.headers['x-user-id']);
    if (!id) {
      throw new UnauthorizedException('Authentication required.');
    }
    request.userId = id;
    return true;
  },
};

const fakeAdminGuard: CanActivate = {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.headers['x-admin'] !== 'yes') {
      throw new ForbiddenException('Administrator access required.');
    }
    return true;
  },
};

// Builds a small application with one controller and the mocked providers it needs.
export async function createHttpTestApp(
  controllers: Type<unknown>[],
  providers: { provide: unknown; useValue: unknown }[],
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ controllers, providers: providers as never[] })
    .overrideGuard(JwtAuthGuard)
    .useValue(fakeJwtGuard)
    .overrideGuard(AdminGuard)
    .useValue(fakeAdminGuard)
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}
