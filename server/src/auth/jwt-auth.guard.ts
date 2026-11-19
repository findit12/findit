import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserStatus } from '../users/user.entity';
import { Repository } from 'typeorm';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  userId?: number;
  user?: User;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @Optional()
    @InjectRepository(User)
    private readonly users?: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const [scheme, token] = typeof header === 'string' ? header.split(' ') : [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Authentication required.');
    }

    let userId: number;
    try {
      const payload = this.jwt.verify<{ sub: string }>(token);
      userId = Number(payload.sub);
      if (!userId) {
        throw new Error('Token without user id.');
      }
    } catch {
      throw new UnauthorizedException('Authentication required.');
    }

    if (this.users) {
      const user = await this.users.findOne({ where: { id: userId } });

      if (!user) {
        throw new UnauthorizedException('Authentication required.');
      }

      if (user.status === UserStatus.Suspended) {
        throw new UnauthorizedException('Account is suspended.');
      }

      request.user = user;
    }

    request.userId = userId;
    return true;
  }
}
