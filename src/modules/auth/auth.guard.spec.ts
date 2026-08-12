import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../../models/user-role.enum';
import { AuthGuard, RequestWithUser } from './auth.guard';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: jest.Mocked<Pick<JwtService, 'verifyAsync'>>;
  let userService: jest.Mocked<Pick<UserService, 'findById'>>;

  const mockUser: User = {
    id: 'user-id',
    email: 'user@example.com',
    passwordHash: 'hashed-password',
    role: UserRole.STANDARD,
    mustChangePassword: false,
    tokenVersion: 1,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const contextWithToken = (token: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () =>
          ({
            headers: { authorization: token ? `Bearer ${token}` : undefined },
          }) as RequestWithUser,
      }),
    }) as never;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    userService = { findById: jest.fn() };
    guard = new AuthGuard(jwtService as never, userService as never);
  });

  const expectUnauthorized = async (token: string) => {
    await expect(guard.canActivate(contextWithToken(token))).rejects.toThrow(
      UnauthorizedException,
    );
  };

  it('should reject a missing token', async () => {
    await expectUnauthorized('');
  });

  it('should reject a token with an invalid signature', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));
    await expectUnauthorized('not-a-valid-token');
  });

  it('should reject a user that no longer exists', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: mockUser.id,
      email: mockUser.email,
      role: mockUser.role,
      ver: mockUser.tokenVersion,
    });
    userService.findById.mockResolvedValue(null);
    await expectUnauthorized('valid-token');
  });

  it('should reject a token whose role is stale', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: mockUser.id,
      email: mockUser.email,
      role: UserRole.ADMIN,
      ver: mockUser.tokenVersion,
    });
    userService.findById.mockResolvedValue(mockUser);
    await expectUnauthorized('valid-token');
  });

  it('should reject a revoked token version', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: mockUser.id,
      email: mockUser.email,
      role: mockUser.role,
      ver: mockUser.tokenVersion - 1,
    });
    userService.findById.mockResolvedValue(mockUser);
    await expectUnauthorized('valid-token');
  });

  it('should authenticate a valid token and expose the current user', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: mockUser.id,
      email: mockUser.email,
      role: mockUser.role,
      ver: mockUser.tokenVersion,
    });
    userService.findById.mockResolvedValue(mockUser);

    const request = {
      headers: { authorization: 'Bearer valid-token' },
    } as RequestWithUser;

    const result = await guard.canActivate({
      switchToHttp: () => ({ getRequest: () => request }),
    } as never);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      sub: mockUser.id,
      email: mockUser.email,
      role: mockUser.role,
      ver: mockUser.tokenVersion,
    });
  });
});
