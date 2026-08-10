import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
    Pick<UserService, 'findByEmail' | 'create' | 'toResponse'>
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;

  const mockUser: User = {
    id: 'c3f6a2b8-9d1e-4f0a-8b7c-5e4d3c2b1a09',
    email: 'user@example.com',
    passwordHash: 'hashed-password',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    userService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      toResponse: jest.fn(),
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
      });
      expect(result).toEqual({ access_token: 'signed-token' });
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
});
