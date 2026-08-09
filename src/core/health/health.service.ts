import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  isHealthy(): { healthy: boolean } {
    return { healthy: true };
  }
}
