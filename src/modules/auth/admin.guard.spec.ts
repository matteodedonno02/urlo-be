import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../models/user-role.enum';
import { AdminGuard } from './admin.guard';
import { RequestWithUser } from './auth.guard';

describe('AdminGuard', () => {
  let guard: AdminGuard;

  const contextWithRole = (role: UserRole) =>
    ({
      switchToHttp: () => ({
        getRequest: () =>
          ({
            user: { sub: 'user-id', email: 'user@example.com', role },
          }) as RequestWithUser,
      }),
    }) as never;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  it('should allow an admin user', () => {
    expect(guard.canActivate(contextWithRole(UserRole.ADMIN))).toBe(true);
  });

  it('should reject a standard user', () => {
    expect(() => guard.canActivate(contextWithRole(UserRole.STANDARD))).toThrow(
      ForbiddenException,
    );
  });
});
