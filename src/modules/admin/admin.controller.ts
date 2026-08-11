import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ShortUrlService } from '../short-url/short-url.service';
import { UserService } from '../user/user.service';
import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';

@UseGuards(AuthGuard, AdminGuard)
@Controller()
export class AdminController {
  constructor(
    private readonly userService: UserService,
    private readonly shortUrlService: ShortUrlService,
  ) {}

  @Get('users')
  findAllUsers() {
    return this.userService.findAll();
  }

  @Get('users/:id')
  async findUser(@Param('id') id: string) {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }
    return this.userService.toResponse(user);
  }

  @Get('users/:id/short-urls')
  async findUserShortUrls(@Param('id') id: string) {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }
    return this.shortUrlService.findByUserId(id);
  }
}
