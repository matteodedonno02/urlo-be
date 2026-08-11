import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import { ShortUrlService } from '../short-url/short-url.service';
import { UserService } from '../user/user.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@UseGuards(AuthGuard, AdminGuard)
@Controller()
export class AdminController {
  constructor(
    private readonly userService: UserService,
    private readonly shortUrlService: ShortUrlService,
    private readonly authService: AuthService,
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

  @HttpCode(HttpStatus.OK)
  @Patch('password')
  async changePassword(
    @Request() req: RequestWithUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      req.user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
    return { message: 'Password updated successfully' };
  }
}
