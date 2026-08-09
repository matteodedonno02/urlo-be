import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShortUrl } from './entities/short-url.entity';
import { ShortUrlController } from './short-url.controller';
import { ShortUrlService } from './short-url.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShortUrl])],
  controllers: [ShortUrlController],
  providers: [ShortUrlService],
})
export class ShortUrlModule {}
