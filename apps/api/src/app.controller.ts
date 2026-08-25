import { Controller, Get } from '@nestjs/common';
import { Public } from './common';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
