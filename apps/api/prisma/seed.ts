import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
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

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
