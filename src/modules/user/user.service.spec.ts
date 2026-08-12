import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserRole } from '../../models/user-role.enum';
import { UserService } from './user.service';
import { User } from './entities/user.entity';

describe('UserService', () => {
  let service: UserService;
  let repository: jest.Mocked<
    Pick<
      Repository<User>,
      'create' | 'find' | 'findOneBy' | 'save' | 'update' | 'increment'
    >
  >;

  const mockEntity = (overrides: Partial<User> = {}): User => ({
    id: 'c3f6a2b8-9d1e-4f0a-8b7c-5e4d3c2b1a09',
    email: 'user@example.com',
    passwordHash: 'hashed-password',
    role: UserRole.STANDARD,
    mustChangePassword: false,
    tokenVersion: 0,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  });

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      increment: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: repository },
      ],
    }).compile();

    service = app.get<UserService>(UserService);
  });

  describe('create', () => {
    it('should create a user with the provided password hash', async () => {
      const entity = mockEntity();
      repository.findOneBy.mockResolvedValue(null);
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue(entity);

      const result = await service.create(
        'user@example.com',
        'hashed-password',
      );

      expect(repository.findOneBy).toHaveBeenCalledWith({
        email: 'user@example.com',
      });
      expect(repository.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        passwordHash: 'hashed-password',
        role: UserRole.STANDARD,
        mustChangePassword: false,
      });
      expect(result).toBe(entity);
    });

    it('should create the user with mustChangePassword set when requested', async () => {
      const entity = mockEntity({ mustChangePassword: true });
      repository.findOneBy.mockResolvedValue(null);
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue(entity);

      await service.create(
        'user@example.com',
        'hashed-password',
        UserRole.ADMIN,
        true,
      );

      expect(repository.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        passwordHash: 'hashed-password',
        role: UserRole.ADMIN,
        mustChangePassword: true,
      });
    });

    it('should throw ConflictException when email already exists', async () => {
      repository.findOneBy.mockResolvedValue(mockEntity());

      await expect(
        service.create('user@example.com', 'hashed-password'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when save fails on unique constraint', async () => {
      repository.findOneBy.mockResolvedValue(null);
      repository.create.mockReturnValue(mockEntity());
      repository.save.mockRejectedValue(new Error('duplicate key'));

      await expect(
        service.create('user@example.com', 'hashed-password'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findByEmail', () => {
    it('should return the entity for an existing email', async () => {
      const entity = mockEntity();
      repository.findOneBy.mockResolvedValue(entity);

      await expect(service.findByEmail('user@example.com')).resolves.toEqual(
        entity,
      );
    });

    it('should return null for an unknown email', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findByEmail('nope@example.com')).resolves.toBeNull();
    });
  });

  describe('findById', () => {
    it('should return the entity for an existing id', async () => {
      const entity = mockEntity();
      repository.findOneBy.mockResolvedValue(entity);

      await expect(service.findById(entity.id)).resolves.toEqual(entity);
    });

    it('should return null for an unknown id', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findById('unknown')).resolves.toBeNull();
    });
  });

  describe('updatePassword', () => {
    it('should update the password hash, clear the change flag, and bump the token version', async () => {
      repository.update.mockResolvedValue({ affected: 1 } as never);
      repository.increment.mockResolvedValue({ affected: 1 } as never);

      await service.updatePassword('user-id', 'new-hashed-password');

      expect(repository.update).toHaveBeenCalledWith('user-id', {
        passwordHash: 'new-hashed-password',
        mustChangePassword: false,
      });
      expect(repository.increment).toHaveBeenCalledWith(
        { id: 'user-id' },
        'tokenVersion',
        1,
      );
    });
  });

  describe('updateRole', () => {
    it('should update the role and bump the token version', async () => {
      repository.update.mockResolvedValue({ affected: 1 } as never);
      repository.increment.mockResolvedValue({ affected: 1 } as never);

      await service.updateRole('user-id', UserRole.ADMIN);

      expect(repository.update).toHaveBeenCalledWith('user-id', {
        role: UserRole.ADMIN,
      });
      expect(repository.increment).toHaveBeenCalledWith(
        { id: 'user-id' },
        'tokenVersion',
        1,
      );
    });
  });

  describe('findAll', () => {
    it('should return all users as responses ordered by creation date', async () => {
      const entities = [mockEntity(), mockEntity({ id: 'other-id' })];
      repository.find.mockResolvedValue(entities);

      const result = await service.findAll();

      expect(repository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(
        entities.map((entity) => service.toResponse(entity)),
      );
      expect(result[0]).not.toHaveProperty('passwordHash');
    });
  });

  describe('toResponse', () => {
    it('should strip the password hash from the response', () => {
      const result = service.toResponse(mockEntity());

      expect(result).toEqual({
        id: 'c3f6a2b8-9d1e-4f0a-8b7c-5e4d3c2b1a09',
        email: 'user@example.com',
        role: UserRole.STANDARD,
        mustChangePassword: false,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });
      expect(result).not.toHaveProperty('passwordHash');
    });
  });
});
