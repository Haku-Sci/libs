import { Module, Controller, Get } from '@nestjs/common';

@Controller()
class HealthController {
  @Get()
  root() {
    return 'OK';
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

@Module({
  controllers: [HealthController],
})
export class HttpHealthAppModule {}
