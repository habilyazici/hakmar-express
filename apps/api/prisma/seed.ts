// The Prisma CLI loads .env through prisma.config.ts before spawning this,
// but loading it here too means the file also runs standalone. dotenv never
// overrides a variable that is already set, so this is a no-op in CI.
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient, Role } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const GEOJSON_VERSION = 1;

async function seedAdmin() {
  const username = process.env.SEED_ADMIN_USERNAME ?? 'superadmin';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.adminUser.upsert({
    where: { username },
    update: {},
    create: {
      username,
      passwordHash,
      fullName: 'Superadmin',
      role: Role.SUPERADMIN,
      isActive: true,
    },
  });

  console.log(`Seeded admin user "${user.username}" (role: ${user.role}).`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`Dev-only password: ${password} — change this before real use.`);
  }
}

/**
 * Province boundaries for the forecast map. Idempotent on (dataType,
 * version): re-running the seed replaces the payload rather than piling up
 * duplicate rows, and bumping GEOJSON_VERSION is what makes a new boundary
 * file take effect.
 */
async function seedGeoJson() {
  const path = join(__dirname, 'data', 'tr-cities.json');
  const raw = readFileSync(path, 'utf8');
  // Parsed as Prisma's JSON input type: the file is a GeoJSON document whose
  // exact shape is the boundary data's business, not the seed's.
  const data = JSON.parse(raw) as Prisma.InputJsonValue;

  const existing = await prisma.geoJsonData.findFirst({
    where: { dataType: 'city' },
    select: { id: true },
  });

  if (existing) {
    await prisma.geoJsonData.update({
      where: { id: existing.id },
      data: { data, version: GEOJSON_VERSION },
    });
  } else {
    await prisma.geoJsonData.create({
      data: { dataType: 'city', data, version: GEOJSON_VERSION },
    });
  }

  const parsed = data as { features?: unknown[] };
  const featureCount = Array.isArray(parsed.features)
    ? parsed.features.length
    : 0;
  console.log(`Seeded city GeoJSON (${featureCount} features, v${GEOJSON_VERSION}).`);
}

async function main() {
  await seedAdmin();
  await seedGeoJson();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
