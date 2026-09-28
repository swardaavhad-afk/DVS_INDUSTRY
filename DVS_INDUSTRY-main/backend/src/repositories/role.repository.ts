import type { IRoleRepository, RoleDto } from '../interfaces';
import { prisma } from '../lib/prismaClient';

/**
 * RoleRepository — thin Prisma adapter.
 * Returns plain DTO objects; no Prisma types leak beyond this layer.
 */
export class RoleRepository implements IRoleRepository {
  async findById(id: number): Promise<RoleDto | null> {
    const role = await prisma.role.findUnique({ where: { id } });
    return role ?? null;
  }

  async findByName(name: string): Promise<RoleDto | null> {
    const role = await prisma.role.findUnique({ where: { name } });
    return role ?? null;
  }

  async findAll(): Promise<RoleDto[]> {
    return prisma.role.findMany({ orderBy: { name: 'asc' } });
  }
}
