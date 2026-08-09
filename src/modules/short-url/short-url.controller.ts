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
} from '@nestjs/common';
import { CreateShortUrlDto } from './dto/create-short-url.dto';
import { UpdateShortUrlDto } from './dto/update-short-url.dto';
import { ShortUrlService } from './short-url.service';

@Controller('short-urls')
export class ShortUrlController {
  constructor(private readonly shortUrlService: ShortUrlService) {}

  @Post()
  create(@Body() createShortUrlDto: CreateShortUrlDto) {
    return this.shortUrlService.create(createShortUrlDto);
  }

  @Get()
  findAll() {
    return this.shortUrlService.findAll();
  }

  @Get(':shortCode')
  @Redirect()
  async resolve(@Param('shortCode') shortCode: string) {
    const result = await this.shortUrlService.resolve(shortCode);
    return { url: result.originalUrl, statusCode: HttpStatus.FOUND };
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateShortUrlDto: UpdateShortUrlDto,
  ) {
    return this.shortUrlService.update(id, updateShortUrlDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.shortUrlService.remove(id);
  }
}
