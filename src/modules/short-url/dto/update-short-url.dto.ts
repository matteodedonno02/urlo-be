import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsSafeRedirectUrl } from '../validators/safe-redirect-url.validator';

export class UpdateShortUrlDto {
  @IsOptional()
  @IsSafeRedirectUrl()
  @MaxLength(2048)
  originalUrl?: string;

  @IsOptional()
  @IsString()
  @Length(3, 16)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'shortCode can only contain letters, numbers, "-" and "_"',
  })
  shortCode?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
