import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor() { }

  isHealthy(): { healthy: boolean } {
    return { healthy: true };
  }
}
