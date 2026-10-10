import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from './jwt-auth.guard';

// Gives a controller method the id of the signed-in user, set by JwtAuthGuard.
// Usage: create(@CurrentUserId() userId: number) { ... }
export const CurrentUserId = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.userId;
});
