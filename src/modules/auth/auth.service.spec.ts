import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { UserRole } from '../../models/user-role.enum';
import { AuthService } from './auth.service';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { RefreshToken } from './entities/refresh-token.entity';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcryptjs';

const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<
    Pick<
      UserService,
      'findByEmail' | 'findById' | 'create' | 'toResponse' | 'updatePassword'
    >
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let refreshTokenRepository: jest.Mocked<
    Pick<RepositoryLike, 'create' | 'save' | 'findOneBy' | 'update'>
  >;

  type RepositoryLike = {
    create: (data: Partial<RefreshToken>) => RefreshToken;
    save: (entity: RefreshToken) => Promise<RefreshToken>;
    findOneBy: (
      criteria: Partial<RefreshToken>,
    ) => Promise<RefreshToken | null>;
    update: (id: string, data: Partial<RefreshToken>) => Promise<unknown>;
  };

  const mockUser: User = {
    id: 'c3f6a2b8-9d1e-4f0a-8b7c-5e4d3c2b1a09',
    email: 'user@example.com',
    passwordHash: 'hashed-password',
    role: UserRole.STANDARD,
    mustChangePassword: false,
    tokenVersion: 0,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  function mockRefreshToken(
    overrides: Partial<RefreshToken> = {},
  ): RefreshToken {
    return {
      id: '11111111-2222-4333-8444-555555555555',
      userId: mockUser.id,
      tokenHash: hashToken('valid-refresh-token'),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      tokenVersion: 0,
      createdAt: new Date(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    userService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      toResponse: jest.fn(),
      updatePassword: jest.fn(),
    };
    jwtService = { signAsync: jest.fn() };
    configService = { get: jest.fn().mockReturnValue('7d') };
    refreshTokenRepository = {
      create: jest.fn((data: Partial<RefreshToken>) => data as RefreshToken),
      save: jest.fn((entity: RefreshToken) => Promise.resolve(entity)),
      findOneBy: jest.fn(),
      update: jest.fn(() => Promise.resolve(undefined)),
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepository,
        },
      ],
    }).compile();

    service = app.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should hash the password and create the user', async () => {
      bcryptMock.hash.mockResolvedValue('hashed-password' as never);
      userService.create.mockResolvedValue(mockUser);
      userService.toResponse.mockReturnValue({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });

      const result = await service.register({
        email: 'user@example.com',
        password: 'plain-password',
      });

      expect(bcryptMock.hash).toHaveBeenCalledWith('plain-password', 10);
      expect(userService.create).toHaveBeenCalledWith(
        'user@example.com',
        'hashed-password',
      );
      expect(result.email).toBe('user@example.com');
    });
  });

  describe('signIn', () => {
    it('should return access and refresh tokens for valid credentials', async () => {
      userService.findByEmail.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(true as never);
      jwtService.signAsync.mockResolvedValue('signed-token');

      const result = await service.signIn('user@example.com', 'plain-password');

      expect(userService.findByEmail).toHaveBeenCalledWith('user@example.com');
      expect(bcryptMock.compare).toHaveBeenCalledWith(
        'plain-password',
        'hashed-password',
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        ver: mockUser.tokenVersion,
      });
      expect(result.access_token).toBe('signed-token');
      expect(result.mustChangePassword).toBe(false);
      expect(result.refresh_token).toBeDefined();
      expect(refreshTokenRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should persist a hashed refresh token snapshotting the user token version', async () => {
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        tokenVersion: 3,
      });
      bcryptMock.compare.mockResolvedValue(true as never);

      await service.signIn('user@example.com', 'plain-password');

      const saved = refreshTokenRepository.save.mock.calls[0][0];
      expect(saved.userId).toBe(mockUser.id);
      expect(saved.tokenVersion).toBe(3);
      expect(saved.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(saved.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return mustChangePassword true when the user must rotate it', async () => {
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        mustChangePassword: true,
      });
      bcryptMock.compare.mockResolvedValue(true as never);
      jwtService.signAsync.mockResolvedValue('signed-token');

      const result = await service.signIn('user@example.com', 'plain-password');

      expect(result).toEqual({
        access_token: 'signed-token',
        refresh_token: result.refresh_token,
        mustChangePassword: true,
      });
    });

    it('should throw UnauthorizedException for an unknown email', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(
        service.signIn('nope@example.com', 'plain-password'),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for a wrong password', async () => {
      userService.findByEmail.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(false as never);

      await expect(
        service.signIn('user@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should rotate the refresh token and issue a new access token', async () => {
      refreshTokenRepository.findOneBy.mockResolvedValue(
        mockRefreshToken({ id: 'token-id-1' }),
      );
      userService.findById.mockResolvedValue(mockUser);
      jwtService.signAsync.mockResolvedValue('signed-token');

      const result = await service.refresh('valid-refresh-token');

      expect(refreshTokenRepository.findOneBy).toHaveBeenCalledWith({
        tokenHash: hashToken('valid-refresh-token'),
      });
      expect(refreshTokenRepository.update).toHaveBeenCalledTimes(1);
      expect(refreshTokenRepository.update.mock.calls[0][0]).toBe('token-id-1');
      expect(
        refreshTokenRepository.update.mock.calls[0][1]?.revokedAt,
      ).toBeInstanceOf(Date);
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        ver: mockUser.tokenVersion,
      });
      expect(result.access_token).toBe('signed-token');
      expect(result.refresh_token).toBeDefined();
      expect(refreshTokenRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should reject an unknown refresh token', async () => {
      refreshTokenRepository.findOneBy.mockResolvedValue(null);

      await expect(service.refresh('unknown-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('should reject a revoked refresh token', async () => {
      refreshTokenRepository.findOneBy.mockResolvedValue(
        mockRefreshToken({ revokedAt: new Date() }),
      );

      await expect(service.refresh('valid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('should reject an expired refresh token', async () => {
      refreshTokenRepository.findOneBy.mockResolvedValue(
        mockRefreshToken({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.refresh('valid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('should reject a refresh token whose user token version changed', async () => {
      refreshTokenRepository.findOneBy.mockResolvedValue(
        mockRefreshToken({ tokenVersion: 0 }),
      );
      userService.findById.mockResolvedValue({ ...mockUser, tokenVersion: 1 });

      await expect(service.refresh('valid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('should reject a refresh token for a deleted user', async () => {
      refreshTokenRepository.findOneBy.mockResolvedValue(mockRefreshToken());
      userService.findById.mockResolvedValue(null);

      await expect(service.refresh('valid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should revoke a valid refresh token', async () => {
      refreshTokenRepository.findOneBy.mockResolvedValue(
        mockRefreshToken({ id: 'token-id-1' }),
      );

      await service.logout('valid-refresh-token');

      expect(refreshTokenRepository.findOneBy).toHaveBeenCalledWith({
        tokenHash: hashToken('valid-refresh-token'),
      });
      expect(refreshTokenRepository.update).toHaveBeenCalledTimes(1);
      expect(refreshTokenRepository.update.mock.calls[0][0]).toBe('token-id-1');
      expect(
        refreshTokenRepository.update.mock.calls[0][1]?.revokedAt,
      ).toBeInstanceOf(Date);
    });

    it('should do nothing for an unknown refresh token', async () => {
      refreshTokenRepository.findOneBy.mockResolvedValue(null);

      await service.logout('unknown-token');

      expect(refreshTokenRepository.update).not.toHaveBeenCalled();
    });

    it('should do nothing for an already revoked refresh token', async () => {
      refreshTokenRepository.findOneBy.mockResolvedValue(
        mockRefreshToken({ revokedAt: new Date() }),
      );

      await service.logout('valid-refresh-token');

      expect(refreshTokenRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('should update the password hash when the current password matches', async () => {
      userService.findById.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(true as never);
      bcryptMock.hash.mockResolvedValue('new-hashed-password' as never);
      userService.updatePassword.mockResolvedValue(undefined);

      await service.changePassword(
        mockUser.id,
        'current-password',
        'new-password',
      );

      expect(userService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(bcryptMock.compare).toHaveBeenCalledWith(
        'current-password',
        'hashed-password',
      );
      expect(bcryptMock.hash).toHaveBeenCalledWith('new-password', 10);
      expect(userService.updatePassword).toHaveBeenCalledWith(
        mockUser.id,
        'new-hashed-password',
      );
    });

    it('should throw UnauthorizedException for an unknown user', async () => {
      userService.findById.mockResolvedValue(null);

      await expect(
        service.changePassword('nope', 'current-password', 'new-password'),
      ).rejects.toThrow(UnauthorizedException);
      expect(userService.updatePassword).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when the current password is wrong', async () => {
      userService.findById.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(false as never);

      await expect(
        service.changePassword(
          mockUser.id,
          'wrong-current-password',
          'new-password',
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(userService.updatePassword).not.toHaveBeenCalled();
    });
  });
});
