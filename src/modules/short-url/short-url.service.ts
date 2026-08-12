import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Equal, LessThan, Like, Repository } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { JwtPayload } from '../../models/jwt-payload';
import { UserRole } from '../../models/user-role.enum';
import { CreateShortUrlDto } from './dto/create-short-url.dto';
import { UpdateShortUrlDto } from './dto/update-short-url.dto';
import { ShortUrlResponseDto } from './dto/short-url-response.dto';
import { ShortUrl } from './entities/short-url.entity';
import { isSafeRedirectUrl } from './validators/safe-redirect-url.validator';
import type { QueryMyShortUrlsDto } from './dto/query-my-short-urls.dto';

const SHORT_CODE_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

export interface PaginatedShortUrls {
  items: ShortUrlResponseDto[];
  nextCursor: string | null;
}

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

  async findByUserIdPaginated(
    userId: string,
    query: QueryMyShortUrlsDto,
  ): Promise<PaginatedShortUrls> {
    const limit = Math.min(query.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;
    const q = query.q?.trim();

    const where = this.buildOwnedUrlsWhere(userId, q, cursor);

    const entities = await this.repository.find({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit + 1,
    });

    const hasMore = entities.length > limit;
    const page = hasMore ? entities.slice(0, limit) : entities;

    return {
      items: page.map((entity) => this.toResponse(entity)),
      nextCursor:
        hasMore && page.length > 0
          ? this.encodeCursor(page[page.length - 1])
          : null,
    };
  }

  private buildOwnedUrlsWhere(
    userId: string,
    q: string | undefined,
    cursor: { createdAt: Date; id: string } | null,
  ): FindOptionsWhere<ShortUrl>[] {
    const branches: FindOptionsWhere<ShortUrl>[] = cursor
      ? [
          { userId, createdAt: LessThan(cursor.createdAt) },
          {
            userId,
            createdAt: Equal(cursor.createdAt),
            id: LessThan(cursor.id),
          },
        ]
      : [{ userId }];

    if (!q) {
      return branches;
    }

    return branches.flatMap((branch) => [
      { ...branch, shortCode: Like(`%${q}%`) },
      { ...branch, originalUrl: Like(`%${q}%`) },
    ]);
  }

  private encodeCursor(entity: ShortUrl): string {
    const raw = `${entity.createdAt.getTime()}:${entity.id}`;
    return Buffer.from(raw).toString('base64url');
  }

  private decodeCursor(cursor: string): { createdAt: Date; id: string } {
    let raw: string;
    try {
      raw = Buffer.from(cursor, 'base64url').toString('utf8');
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
    const separator = raw.indexOf(':');
    if (separator === -1) {
      throw new BadRequestException('Invalid cursor');
    }
    const timestamp = Number(raw.slice(0, separator));
    const id = raw.slice(separator + 1);
    if (!Number.isFinite(timestamp) || !id) {
      throw new BadRequestException('Invalid cursor');
    }
    return { createdAt: new Date(timestamp), id };
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
    if (!isSafeRedirectUrl(entity.originalUrl)) {
      throw new NotFoundException(`Short URL "${shortCode}" not found`);
    }
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

  async updateOriginalUrl(
    id: string,
    originalUrl: string,
    requester: JwtPayload,
  ): Promise<ShortUrlResponseDto> {
    const entity = await this.repository.findOneBy({ id });
    if (!entity) {
      throw new NotFoundException(`Short URL with id "${id}" not found`);
    }
    this.assertCanModify(entity, requester);
    entity.originalUrl = originalUrl;
    return this.toResponse(await this.repository.save(entity));
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
