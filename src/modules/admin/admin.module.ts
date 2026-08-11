import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ShortUrlModule } from '../short-url/short-url.module';
import { UserModule } from '../user/user.module';
import { AdminController } from './admin.controller';
import { AdminSeedService } from './admin.seed.service';

@Module({
  imports: [AuthModule, UserModule, ShortUrlModule],
  controllers: [AdminController],
  providers: [AdminSeedService],
})
export class AdminModule {}
