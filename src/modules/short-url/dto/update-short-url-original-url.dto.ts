import { MaxLength } from 'class-validator';
import { IsSafeRedirectUrl } from '../validators/safe-redirect-url.validator';

export class UpdateShortUrlOriginalUrlDto {
  @IsSafeRedirectUrl()
  @MaxLength(2048)
  originalUrl!: string;
}
