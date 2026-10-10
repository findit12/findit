import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// The part of the HTTP request that the guard reads and completes.
export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  userId?: number;
}

// Protects a route: the request must carry "Authorization: Bearer <token>" with a valid session token.
// If the token is valid, the id of the user is stored in request.userId for the controller.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const [scheme, token] = typeof header === 'string' ? header.split(' ') : [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Authentication required.');
    }

    try {
      const payload = this.jwt.verify<{ sub: string }>(token);
      const userId = Number(payload.sub);
      if (!userId) {
        throw new Error('Token without user id.');
      }
      request.userId = userId;
      return true;
    } catch {
      throw new UnauthorizedException('Authentication required.');
    }
  }
}
