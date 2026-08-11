import { IsDateString, IsOptional, MaxLength } from 'class-validator';
import { IsSafeRedirectUrl } from '../validators/safe-redirect-url.validator';

export class CreateShortUrlDto {
  @IsSafeRedirectUrl()
  @MaxLength(2048)
  originalUrl!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
