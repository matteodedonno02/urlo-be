import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '../../models/user-role.enum';
import { UserService } from '../user/user.service';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.configService.get<string>('admin.email');
    const password = this.configService.get<string>('admin.password');

    if (!email || !password) {
      this.logger.warn(
        'admin.email / admin.password not configured, skipping admin bootstrap.',
      );
      return;
    }

    const existing = await this.userService.findByEmail(email);
    if (existing) {
      this.logger.log(`Admin user "${email}" already exists, skipping.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.userService.create(email, passwordHash, UserRole.ADMIN, true);
    this.logger.log(`Created admin user "${email}".`);
  }
}
