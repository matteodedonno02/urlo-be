import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { In, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { JwtPayload } from '../../models/jwt-payload';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { RefreshToken } from './entities/refresh-token.entity';

const BCRYPT_ROUNDS = 10;
const REFRESH_TOKEN_BYTES = 48;
const DEFAULT_REFRESH_TTL = '7d';
const CLEANUP_BATCH_SIZE = 200;
const CLEANUP_MAX_BATCHES = 5;

const DURATION_MULTIPLIERS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(dto: CreateUserDto): Promise<UserResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.userService.create(dto.email, passwordHash);
    return this.userService.toResponse(user);
  }

  async signIn(
    email: string,
    password: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
    mustChangePassword: boolean;
  }> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException();
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException();
    }

    return {
      access_token: await this.jwtService.signAsync(this.toPayload(user)),
      refresh_token: await this.issueRefreshToken(user),
      mustChangePassword: user.mustChangePassword,
    };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const entity = await this.refreshTokenRepository.findOneBy({
      tokenHash: this.hashToken(refreshToken),
    });
    if (
      !entity ||
      entity.revokedAt !== null ||
      entity.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException();
    }

    const user = await this.userService.findById(entity.userId);
    if (!user || user.tokenVersion !== entity.tokenVersion) {
      throw new UnauthorizedException();
    }

    await this.revokeToken(entity);
    return {
      access_token: await this.jwtService.signAsync(this.toPayload(user)),
      refresh_token: await this.issueRefreshToken(user),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const entity = await this.refreshTokenRepository.findOneBy({
      tokenHash: this.hashToken(refreshToken),
    });
    if (entity && entity.revokedAt === null) {
      await this.revokeToken(entity);
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userService.updatePassword(userId, passwordHash);
  }

  private async issueRefreshToken(user: User): Promise<string> {
    const raw = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const ttl = this.refreshTtlMs();
    await this.cleanupExpiredTokens();
    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        userId: user.id,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + ttl),
        tokenVersion: user.tokenVersion,
      }),
    );
    return raw;
  }

  private async revokeToken(entity: RefreshToken): Promise<void> {
    await this.refreshTokenRepository.update(entity.id, {
      revokedAt: new Date(),
    });
  }

  private async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();
    try {
      for (let batch = 0; batch < CLEANUP_MAX_BATCHES; batch += 1) {
        const expired = await this.refreshTokenRepository.find({
          select: { id: true },
          where: [
            { expiresAt: LessThanOrEqual(now) },
            { revokedAt: Not(IsNull()) },
          ],
          take: CLEANUP_BATCH_SIZE,
        });
        if (expired.length === 0) {
          return;
        }
        await this.refreshTokenRepository.delete({
          id: In(expired.map((token) => token.id)),
        });
        if (expired.length < CLEANUP_BATCH_SIZE) {
          return;
        }
      }
    } catch (err) {
      this.logger.warn(
        `Failed to clean up expired refresh tokens: ${(err as Error).message}`,
      );
    }
  }

  private toPayload(user: User): JwtPayload {
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      ver: user.tokenVersion,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshTtlMs(): number {
    const configured =
      this.configService.get<string>('jwt.refreshExpiresIn') ??
      DEFAULT_REFRESH_TTL;
    const match = /^(\d+)\s*(ms|s|m|h|d|w)?$/.exec(configured.trim());
    if (!match) {
      throw new Error(`Invalid jwt.refreshExpiresIn: "${configured}"`);
    }
    const amount = Number(match[1]);
    const unit = match[2] ?? 's';
    return amount * DURATION_MULTIPLIERS[unit];
  }
}
