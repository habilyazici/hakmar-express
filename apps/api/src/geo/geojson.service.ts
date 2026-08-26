import { Injectable } from '@nestjs/common';
import type { GeoJsonPayload } from '@hakmar/contracts';
import { PrismaService } from '../prisma';

@Injectable()
export class GeoJsonService {
  constructor(private readonly prisma: PrismaService) {}

  async find(dataType: string): Promise<GeoJsonPayload | null> {
    // Highest version wins, so re-seeding with a newer boundary file takes
    // effect without having to delete the old row first.
    const row = await this.prisma.geoJsonData.findFirst({
      where: { dataType },
      orderBy: { version: 'desc' },
      select: { dataType: true, version: true, data: true },
    });
    return row ?? null;
  }
}
