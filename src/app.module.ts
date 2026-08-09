import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './core/health/health.module';
import { DatabaseModule } from './database/database.module';
import { ShortUrlModule } from './modules/short-url/short-url.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    HealthModule,
    DatabaseModule,
    ShortUrlModule,
  ],
})
export class AppModule {}
