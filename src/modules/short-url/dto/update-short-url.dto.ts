import {
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateShortUrlDto {
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'originalUrl must be a valid URL' })
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
