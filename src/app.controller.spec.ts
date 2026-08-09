import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './utils/configuration';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    process.env.NODE_ENV = 'dev';
    const app: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ load: [configuration] })],
      controllers: [AppController],
      providers: [AppService, ConfigService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return a greeting with the configured port', () => {
      expect(appController.getHello()).toBe('Hello World! (port 3000)');
    });
  });
});
