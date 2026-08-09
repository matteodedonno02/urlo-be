export class ShortUrlResponseDto {
  id!: string;
  shortCode!: string;
  originalUrl!: string;
  visitCount!: number;
  expiresAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}
