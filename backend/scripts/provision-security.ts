import 'dotenv/config';
import { Client } from 'pg';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const adminDatabaseUrl = process.env['ADMIN_DATABASE_URL'] ?? process.env['DATABASE_URL'];
const appDatabaseUser = process.env['APP_DATABASE_USER'] ?? 'dvs_app';
const appDatabasePassword = process.env['APP_DATABASE_PASSWORD'];
const adminEmail = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@dvsindustry.com';
const adminPassword = process.env['SEED_ADMIN_PASSWORD'];

if (!adminDatabaseUrl || !appDatabasePassword || !adminPassword) {
  throw new Error('Database admin URL, app password, and admin password are required.');
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: adminDatabaseUrl });
  await client.connect();
  const user = quoteIdentifier(appDatabaseUser);
  const password = quoteLiteral(appDatabasePassword);
  await client.query(`DO $provision$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${quoteLiteral(appDatabaseUser)}) THEN CREATE ROLE ${user} LOGIN PASSWORD ${password}; ELSE ALTER ROLE ${user} WITH LOGIN PASSWORD ${password}; END IF; END $provision$;`);
  await client.query(`GRANT CONNECT ON DATABASE dvs_factory TO ${user}`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${user}`);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${user}`);
  await client.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${user}`);
  await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${user}`);
  await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${user}`);
  await client.end();

  const prisma = new PrismaClient();
  await prisma.user.update({ where: { email: adminEmail }, data: { password: await bcrypt.hash(adminPassword, 12) } });
  await prisma.$disconnect();
  console.log(`Provisioned ${appDatabaseUser} and rotated ${adminEmail}.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
