import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Redirect,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import { CreateShortUrlDto } from './dto/create-short-url.dto';
import { UpdateShortUrlDto } from './dto/update-short-url.dto';
import { ShortUrlService } from './short-url.service';

@Controller('short-urls')
export class ShortUrlController {
  constructor(private readonly shortUrlService: ShortUrlService) {}

  @UseGuards(AuthGuard)
  @Post()
  create(
    @Body() createShortUrlDto: CreateShortUrlDto,
    @Request() req: RequestWithUser,
  ) {
    return this.shortUrlService.create(createShortUrlDto, req.user.sub);
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Get()
  findAll() {
    return this.shortUrlService.findAll();
  }

  @UseGuards(AuthGuard)
  @Get('my')
  findMine(@Request() req: RequestWithUser) {
    return this.shortUrlService.findByUserId(req.user.sub);
  }

  @Get(':shortCode')
  @Redirect()
  async resolve(@Param('shortCode') shortCode: string) {
    const result = await this.shortUrlService.resolve(shortCode);
    return { url: result.originalUrl, statusCode: HttpStatus.FOUND };
  }

  @UseGuards(AuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateShortUrlDto: UpdateShortUrlDto,
    @Request() req: RequestWithUser,
  ) {
    return this.shortUrlService.update(id, updateShortUrlDto, req.user);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ): Promise<void> {
    await this.shortUrlService.remove(id, req.user);
  }
}
