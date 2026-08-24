import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseEnumPipe,
  UseInterceptors,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { GeoJsonService } from './geojson.service';

export enum GeoJsonType {
  CITY = 'city',
}

@Controller('geo/geojson')
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.ANALYST)
@UseInterceptors(CacheInterceptor)
export class GeoJsonController {
  constructor(private readonly geojson: GeoJsonService) {}

  /**
   * Province boundaries are a few hundred kilobytes that change essentially
   * never, so this is cached for a day rather than the minutes the analytics
   * routes use.
   */
  @Get(':type')
  @CacheTTL(24 * 60 * 60 * 1000)
  async get(@Param('type', new ParseEnumPipe(GeoJsonType)) type: GeoJsonType) {
    const found = await this.geojson.find(type);
    if (!found) {
      // Distinct from a 500: the table is simply unseeded, and the message
      // says exactly which command fixes it.
      throw new NotFoundException(
        `No "${type}" GeoJSON has been loaded. Run: pnpm --filter api exec prisma db seed`,
      );
    }
    return found;
  }
}
