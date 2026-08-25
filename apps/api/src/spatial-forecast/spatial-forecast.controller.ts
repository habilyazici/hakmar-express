import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import {
  CurrentUser,
  Roles,
  type AuthenticatedUser,
  LimitQueryDto,
} from '../common';
import { ForecastRequestDto } from './dto/forecast-request.dto';
import { SpatialForecastService } from './spatial-forecast.service';

@Controller('spatial-forecast')
export class SpatialForecastController {
  constructor(private readonly forecast: SpatialForecastService) {}

  /**
   * POST rather than GET because each call records a SpatialForecastRun: the
   * request is a simulation someone ran, and the history of what was run is
   * part of the feature. It is also why this route is not cached — the
   * parameter space is large and each run is meant to be reproducible from
   * its stored record instead.
   */
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.ANALYST)
  @Post('run')
  async run(
    @Body() dto: ForecastRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.forecast.run(dto);
    const runId = await this.forecast.saveRun(result, user.sub);
    return { runId, ...result };
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.ANALYST)
  @Get('runs')
  listRuns(@Query() query: LimitQueryDto) {
    return this.forecast.listRuns(query.limit ?? 50);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.ANALYST)
  @Get('runs/:id')
  getRun(@Param('id', ParseIntPipe) id: number) {
    return this.forecast.getRun(id);
  }
}
