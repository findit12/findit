import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../users/user.entity';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';

function contextFor(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const jwt = { verify: jest.fn() };
  const users = { findOne: jest.fn() };
  const guard = new JwtAuthGuard(
    jwt as unknown as JwtService,
    users as unknown as Repository<User>,
  );

  afterEach(() => jest.resetAllMocks());

  it('refuses a request without Authorization header', async () => {
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toThrow(UnauthorizedException);
  });

  it('refuses a header that is not "Bearer <token>"', async () => {
    await expect(guard.canActivate(contextFor({ headers: {authorization: 'Basic abc' } }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refuses an invalid or expired token', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    await expect(guard.canActivate(contextFor({ headers: {authorization: 'Bearer bad' } }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a valid token for an active user and stores the user id in the request', async () => {
    jwt.verify.mockReturnValue({ sub: '12' });
    users.findOne.mockResolvedValue({ id: 12, status: UserStatus.Active });
    const request: AuthenticatedRequest = { headers: { authorization: 'Bearer good' } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.userId) .toBe(12);
  });

  it('refuses a valid token when the user account is suspended', async () => {
    jwt.verify.mockReturnValue({ sub: '12' });
    users.findOne.mockResolvedValue({ id: 12, status: UserStatus.Suspended });
    const request: AuthenticatedRequest = { headers: {authorization: 'Bearer good' } };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(UnauthorizedException);
  });

  it('refuses a valid token when the account was deleted (FR-25)', async () => {
    jwt.verify.mockReturnValue({ sub: '12' });
    users.findOne.mockResolvedValue({ id: 12, status: UserStatus.Anonymized });
    const request: AuthenticatedRequest = { headers: { authorization: 'Bearer good' } };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow('Authentication required.');
    expect(request.userId).toBeUndefined();
  });
});
