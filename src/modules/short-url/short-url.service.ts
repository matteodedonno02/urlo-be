import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { JwtPayload } from '../../models/jwt-payload';
import { UserRole } from '../../models/user-role.enum';
import { CreateShortUrlDto } from './dto/create-short-url.dto';
import { UpdateShortUrlDto } from './dto/update-short-url.dto';
import { ShortUrlResponseDto } from './dto/short-url-response.dto';
import { ShortUrl } from './entities/short-url.entity';

const SHORT_CODE_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';

@Injectable()
export class ShortUrlService {
  constructor(
    @InjectRepository(ShortUrl)
    private readonly repository: Repository<ShortUrl>,
  ) {}

  async create(
    dto: CreateShortUrlDto,
    userId: string,
  ): Promise<ShortUrlResponseDto> {
    const shortCode = await this.generateUniqueShortCode();

    const entity = this.repository.create({
      originalUrl: dto.originalUrl,
      shortCode,
      userId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });

    try {
      return this.toResponse(await this.repository.save(entity));
    } catch {
      throw new ConflictException('shortCode is already in use');
    }
  }

  async findAll(): Promise<ShortUrlResponseDto[]> {
    const entities = await this.repository.find({
      order: { createdAt: 'DESC' },
    });
    return entities.map((entity) => this.toResponse(entity));
  }

  async findByUserId(userId: string): Promise<ShortUrlResponseDto[]> {
    const entities = await this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return entities.map((entity) => this.toResponse(entity));
  }

  async findByShortCode(shortCode: string): Promise<ShortUrl> {
    const entity = await this.repository.findOneBy({ shortCode });
    if (!entity) {
      throw new NotFoundException(`Short URL "${shortCode}" not found`);
    }
    if (entity.expiresAt && entity.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundException(`Short URL "${shortCode}" has expired`);
    }
    return entity;
  }

  async resolve(shortCode: string): Promise<ShortUrlResponseDto> {
    const entity = await this.findByShortCode(shortCode);
    entity.visitCount += 1;
    await this.repository.save(entity);
    return this.toResponse(entity);
  }

  async update(
    id: string,
    dto: UpdateShortUrlDto,
    requester: JwtPayload,
  ): Promise<ShortUrlResponseDto> {
    const entity = await this.repository.findOneBy({ id });
    if (!entity) {
      throw new NotFoundException(`Short URL with id "${id}" not found`);
    }
    this.assertCanModify(entity, requester);

    if (dto.shortCode !== undefined && dto.shortCode !== entity.shortCode) {
      await this.assertShortCodeAvailable(dto.shortCode);
      entity.shortCode = dto.shortCode;
    }
    if (dto.originalUrl !== undefined) {
      entity.originalUrl = dto.originalUrl;
    }
    if (dto.expiresAt !== undefined) {
      entity.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }

    try {
      return this.toResponse(await this.repository.save(entity));
    } catch {
      throw new ConflictException('shortCode is already in use');
    }
  }

  async remove(id: string, requester: JwtPayload): Promise<void> {
    const entity = await this.repository.findOneBy({ id });
    if (!entity) {
      throw new NotFoundException(`Short URL with id "${id}" not found`);
    }
    this.assertCanModify(entity, requester);
    await this.repository.remove(entity);
  }

  private assertCanModify(entity: ShortUrl, requester: JwtPayload): void {
    if (entity.userId !== requester.sub && requester.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You are not the owner of this short URL');
    }
  }

  private async assertShortCodeAvailable(shortCode: string): Promise<void> {
    const existing = await this.repository.findOneBy({ shortCode });
    if (existing) {
      throw new ConflictException('shortCode is already in use');
    }
  }

  private async generateUniqueShortCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = this.randomShortCode();
      const existing = await this.repository.findOneBy({
        shortCode: candidate,
      });
      if (!existing) {
        return candidate;
      }
    }
    throw new ConflictException(
      'Could not generate a unique shortCode, please retry',
    );
  }

  private randomShortCode(): string {
    const bytes = randomBytes(6);
    let code = '';
    for (const byte of bytes) {
      code += SHORT_CODE_ALPHABET[byte % SHORT_CODE_ALPHABET.length];
    }
    return code;
  }

  private toResponse(entity: ShortUrl): ShortUrlResponseDto {
    return {
      id: entity.id,
      userId: entity.userId,
      shortCode: entity.shortCode,
      originalUrl: entity.originalUrl,
      visitCount: entity.visitCount,
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
