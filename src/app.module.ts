import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './core/health/health.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { ShortUrlModule } from './modules/short-url/short-url.module';
import { UserModule } from './modules/user/user.module';
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
    UserModule,
    AuthModule,
    AdminModule,
  ],
})
export class AppModule {}
