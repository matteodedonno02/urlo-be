import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../models/user-role.enum';
import type { RequestWithUser } from './auth.guard';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin role is required');
    }
    return true;
  }
}
