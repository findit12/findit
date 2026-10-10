import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';

// Builds the minimal NestJS context the guard needs, around a fake request.
function contextFor(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const jwt = { verify: jest.fn() };
  const guard = new JwtAuthGuard(jwt as unknown as JwtService);

  afterEach(() => jest.resetAllMocks());

  it('refuses a request without Authorization header', () => {
    expect(() => guard.canActivate(contextFor({ headers: {} }))).toThrow(UnauthorizedException);
  });

  it('refuses a header that is not "Bearer <token>"', () => {
    expect(() => guard.canActivate(contextFor({ headers: { authorization: 'Basic abc' } }))).toThrow(
      UnauthorizedException,
    );
  });

  it('refuses an invalid or expired token', () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    expect(() => guard.canActivate(contextFor({ headers: { authorization: 'Bearer bad' } }))).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a valid token and stores the user id in the request', () => {
    jwt.verify.mockReturnValue({ sub: '12' });
    const request: AuthenticatedRequest = { headers: { authorization: 'Bearer good' } };

    expect(guard.canActivate(contextFor(request))).toBe(true);
    expect(request.userId).toBe(12);
  });
});
