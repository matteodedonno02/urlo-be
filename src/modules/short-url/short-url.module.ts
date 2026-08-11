import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ShortUrl } from './entities/short-url.entity';
import { ShortUrlController } from './short-url.controller';
import { ShortUrlService } from './short-url.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShortUrl]), AuthModule],
  controllers: [ShortUrlController],
  providers: [ShortUrlService],
  exports: [ShortUrlService],
})
export class ShortUrlModule {}
