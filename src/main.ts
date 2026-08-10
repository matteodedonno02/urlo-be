import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;
  const host = configService.get<string>('host') ?? '127.0.0.1';
  const corsWhitelist = configService.get<string[]>('cors.whitelist') ?? [];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || corsWhitelist.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  });
  await app.listen(port, host);
}
void bootstrap();
