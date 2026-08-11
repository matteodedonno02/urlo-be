import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../models/user-role.enum';
import { AuthService } from './auth.service';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcryptjs';

const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<
    Pick<
      UserService,
      'findByEmail' | 'findById' | 'create' | 'toResponse' | 'updatePassword'
    >
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;

  const mockUser: User = {
    id: 'c3f6a2b8-9d1e-4f0a-8b7c-5e4d3c2b1a09',
    email: 'user@example.com',
    passwordHash: 'hashed-password',
    role: UserRole.STANDARD,
    mustChangePassword: false,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    userService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      toResponse: jest.fn(),
      updatePassword: jest.fn(),
    };
    jwtService = { signAsync: jest.fn() };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
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
    it('should return an access token for valid credentials', async () => {
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
      });
      expect(result).toEqual({
        access_token: 'signed-token',
        mustChangePassword: false,
      });
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
