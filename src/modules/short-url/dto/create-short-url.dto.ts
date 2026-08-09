import { IsDateString, IsOptional, IsUrl, MaxLength } from 'class-validator';

export class CreateShortUrlDto {
  @IsUrl({ require_tld: false }, { message: 'originalUrl must be a valid URL' })
  @MaxLength(2048)
  originalUrl!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
