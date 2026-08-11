import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserRole } from '../../models/user-role.enum';
import { ShortUrlService } from './short-url.service';
import { ShortUrl } from './entities/short-url.entity';

describe('ShortUrlService', () => {
  let service: ShortUrlService;
  let repository: jest.Mocked<
    Pick<
      Repository<ShortUrl>,
      'create' | 'find' | 'findOneBy' | 'save' | 'remove'
    >
  >;

  const requester = (
    overrides: Partial<{ sub: string; role: UserRole }> = {},
  ): { sub: string; email: string; role: UserRole } => ({
    sub: 'user-1',
    email: 'user@example.com',
    role: UserRole.STANDARD,
    ...overrides,
  });

  const mockEntity = (overrides: Partial<ShortUrl> = {}): ShortUrl => ({
    id: 'c3f6a2b8-9d1e-4f0a-8b7c-5e4d3c2b1a09',
    userId: 'user-1',
    shortCode: 'abc123',
    originalUrl: 'https://example.com',
    visitCount: 0,
    expiresAt: null,
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
      remove: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        ShortUrlService,
        { provide: getRepositoryToken(ShortUrl), useValue: repository },
      ],
    }).compile();

    service = app.get<ShortUrlService>(ShortUrlService);
  });

  describe('create', () => {
    it('should create a short url with an auto-generated shortCode', async () => {
      const entity = mockEntity();
      repository.findOneBy.mockResolvedValue(null);
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue(entity);

      const result = await service.create(
        { originalUrl: 'https://example.com' },
        'user-1',
      );

      const generatedCode = repository.create.mock.calls[0][0].shortCode;
      expect(generatedCode).toHaveLength(6);
      expect(repository.findOneBy).toHaveBeenCalledWith({
        shortCode: generatedCode,
      });
      expect(repository.create).toHaveBeenCalledWith({
        originalUrl: 'https://example.com',
        shortCode: generatedCode,
        userId: 'user-1',
        expiresAt: null,
      });
      expect(result).toEqual({
        id: 'c3f6a2b8-9d1e-4f0a-8b7c-5e4d3c2b1a09',
        userId: 'user-1',
        shortCode: 'abc123',
        originalUrl: 'https://example.com',
        visitCount: 0,
        expiresAt: null,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      });
    });

    it('should generate a unique shortCode', async () => {
      const entity = mockEntity({ shortCode: 'generated' });
      repository.findOneBy.mockResolvedValueOnce(null);
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue(entity);

      const result = await service.create(
        { originalUrl: 'https://example.com' },
        'user-1',
      );

      const createArg = repository.create.mock.calls[0][0];
      expect(createArg.shortCode).toHaveLength(6);
      expect(result.shortCode).toBe('generated');
    });
  });

  describe('findAll', () => {
    it('should return all short urls as response DTOs', async () => {
      repository.find.mockResolvedValue([
        mockEntity(),
        mockEntity({ id: 'e1a2b3c4-5d6e-4f7a-8b9c-0d1e2f3a4b5c' }),
      ]);

      const result = await service.findAll();

      expect(repository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('shortCode', 'abc123');
    });
  });

  describe('findByUserId', () => {
    it('should return only the short urls of the given user', async () => {
      repository.find.mockResolvedValue([
        mockEntity(),
        mockEntity({ id: 'e1a2b3c4-5d6e-4f7a-8b9c-0d1e2f3a4b5c' }),
      ]);

      const result = await service.findByUserId('user-1');

      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('shortCode', 'abc123');
    });

    it('should return an empty array when the user has no short urls', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.findByUserId('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('findByShortCode', () => {
    it('should return the entity for an existing shortCode', async () => {
      const entity = mockEntity();
      repository.findOneBy.mockResolvedValue(entity);

      await expect(service.findByShortCode('abc123')).resolves.toEqual(entity);
    });

    it('should throw NotFoundException for an unknown shortCode', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findByShortCode('nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for an expired short url', async () => {
      repository.findOneBy.mockResolvedValue(
        mockEntity({
          expiresAt: new Date(Date.now() - 1000),
        }),
      );

      await expect(service.findByShortCode('abc123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resolve', () => {
    it('should increment visit count and return the response', async () => {
      const entity = mockEntity({ visitCount: 3 });
      repository.findOneBy.mockResolvedValue(entity);
      repository.save.mockResolvedValue({ ...entity, visitCount: 4 });

      const result = await service.resolve('abc123');

      expect(entity.visitCount).toBe(4);
      expect(repository.save).toHaveBeenCalledWith(entity);
      expect(result.visitCount).toBe(4);
    });

    it('should throw NotFoundException for an unknown shortCode', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.resolve('nope')).rejects.toThrow(NotFoundException);
    });

    it('should not redirect to a stored unsafe URL', async () => {
      repository.findOneBy.mockResolvedValue(
        mockEntity({ originalUrl: 'http://192.168.1.1' }),
      );

      await expect(service.resolve('abc123')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update the originalUrl', async () => {
      const entity = mockEntity();
      repository.findOneBy.mockResolvedValue(entity);
      repository.save.mockResolvedValue({
        ...entity,
        originalUrl: 'https://new.example.com',
      });

      const result = await service.update(
        '1',
        { originalUrl: 'https://new.example.com' },
        requester(),
      );

      expect(entity.originalUrl).toBe('https://new.example.com');
      expect(result.originalUrl).toBe('https://new.example.com');
    });

    it('should throw NotFoundException for an unknown id', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('999', { originalUrl: 'https://x.com' }, requester()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when shortCode collides with another record', async () => {
      const entity = mockEntity({ shortCode: 'mine' });
      repository.findOneBy.mockResolvedValueOnce(entity);
      repository.findOneBy.mockResolvedValueOnce(
        mockEntity({ shortCode: 'theirs' }),
      );

      await expect(
        service.update('1', { shortCode: 'theirs' }, requester()),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException when the requester is not the owner', async () => {
      repository.findOneBy.mockResolvedValue(mockEntity({ userId: 'other' }));

      await expect(
        service.update('1', { originalUrl: 'https://x.com' }, requester()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow an admin to update someone elses short url', async () => {
      const entity = mockEntity({ userId: 'other' });
      repository.findOneBy.mockResolvedValue(entity);
      repository.save.mockResolvedValue({
        ...entity,
        originalUrl: 'https://new.example.com',
      });

      const result = await service.update(
        '1',
        { originalUrl: 'https://new.example.com' },
        requester({ role: UserRole.ADMIN }),
      );

      expect(result.originalUrl).toBe('https://new.example.com');
    });
  });

  describe('remove', () => {
    it('should delete the short url owned by the requester', async () => {
      const entity = mockEntity();
      repository.findOneBy.mockResolvedValue(entity);
      repository.remove.mockResolvedValue(entity);

      await expect(service.remove('1', requester())).resolves.toBeUndefined();
      expect(repository.remove).toHaveBeenCalledWith(entity);
    });

    it('should throw NotFoundException for an unknown id', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.remove('999', requester())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when the requester is not the owner', async () => {
      repository.findOneBy.mockResolvedValue(mockEntity({ userId: 'other' }));

      await expect(service.remove('1', requester())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow an admin to remove someone elses short url', async () => {
      const entity = mockEntity({ userId: 'other' });
      repository.findOneBy.mockResolvedValue(entity);
      repository.remove.mockResolvedValue(entity);

      await expect(
        service.remove('1', requester({ role: UserRole.ADMIN })),
      ).resolves.toBeUndefined();
    });
  });
});
