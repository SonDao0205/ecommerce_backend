import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @HttpCode(200)
  async readiness(@Res({ passthrough: true }) response: Response) {
    const result = await this.healthService.readiness();
    if (result.status === 'error') response.status(503);
    return result;
  }
}
