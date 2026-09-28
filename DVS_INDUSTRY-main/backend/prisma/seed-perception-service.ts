import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

type SeedClient = Pick<PrismaClient, 'user'>;

export async function seedPerceptionServiceAccount(
  prisma: SeedClient,
  roleId: number,
): Promise<boolean> {
  const email = process.env['SEED_PERCEPTION_SERVICE_EMAIL']?.trim();
  const password = process.env['SEED_PERCEPTION_SERVICE_PASSWORD'];

  if (!email || !password) {
    console.log('   - Perception service account skipped: credentials are not configured');
    return false;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      fullName: 'Perception Service',
      password: hashedPassword,
      roleId,
      isActive: true,
    },
    create: {
      fullName: 'Perception Service',
      email,
      password: hashedPassword,
      roleId,
      isActive: true,
    },
  });

  console.log(`   ✓ Perception service account ready: ${user.email}`);
  return true;
}