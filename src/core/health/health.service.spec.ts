import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();

    service = app.get<HealthService>(HealthService);
  });

  describe('isHealthy', () => {
    it('should return healthy status', () => {
      expect(service.isHealthy()).toEqual({ healthy: true });
    });
  });
});
