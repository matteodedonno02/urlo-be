import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ShortUrlModule } from '../short-url/short-url.module';
import { UserModule } from '../user/user.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [AuthModule, UserModule, ShortUrlModule],
  controllers: [AdminController],
})
export class AdminModule {}
