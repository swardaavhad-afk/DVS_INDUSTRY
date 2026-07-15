/**
 * Prisma seed script — run once to populate reference data.
 *
 *   npm run db:seed
 *
 * Safe to run multiple times (upsert on unique fields).
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ── Seed data ───────────────────────────────────────────────────────────────

const roles = [
  {
    name: 'ADMIN',
    description: 'Full system access. Manages users, roles, and all modules.',
  },
  {
    name: 'MANAGER',
    description: 'Cross-department oversight. Can view reports and manage teams.',
  },
  {
    name: 'HR',
    description: 'Human Resources — manages employee records and workforce data.',
  },
  {
    name: 'STORE',
    description: 'Inventory and warehouse management.',
  },
  {
    name: 'PRODUCTION',
    description: 'Production floor — manages work orders and manufacturing.',
  },
  {
    name: 'SALES',
    description: 'Sales team — manages orders, clients, and quotations.',
  },
] as const;

async function seedRoles(): Promise<Map<string, number>> {
  console.log('🌱  Seeding roles…');
  const roleMap = new Map<string, number>();

  for (const role of roles) {
    const upserted = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });
    roleMap.set(upserted.name, upserted.id);
    console.log(`   ✓ Role: ${upserted.name} (id: ${upserted.id})`);
  }

  return roleMap;
}

async function seedAdminUser(adminRoleId: number): Promise<void> {
  console.log('\n🌱  Seeding admin user…');

  const adminEmail = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@dvsindustry.com';
  const adminPassword = process.env['SEED_ADMIN_PASSWORD'] ?? 'Admin@1234!';

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existing !== null) {
    console.log(`   ⚠  Admin user already exists: ${adminEmail} — skipping`);
    return;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.create({
    data: {
      fullName: 'DVS Administrator',
      email: adminEmail,
      password: hashedPassword,
      roleId: adminRoleId,
      isActive: true,
    },
  });

  console.log(`   ✓ Admin user created: ${admin.email} (id: ${admin.id})`);
  console.log(
    `   ⚠  IMPORTANT: Change the admin password immediately after first login!`,
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('─'.repeat(50));
  console.log('DVS Industry — Database Seed');
  console.log('─'.repeat(50));

  const roleMap = await seedRoles();

  const adminId = roleMap.get('ADMIN');
  if (adminId === undefined) {
    throw new Error('ADMIN role was not created — cannot seed admin user');
  }

  await seedAdminUser(adminId);

  console.log('\n✅  Seed complete');
  console.log('─'.repeat(50));
}

main()
  .catch((err) => {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
