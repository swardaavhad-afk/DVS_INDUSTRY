import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prismaClient';
import type {
  IDepartmentRepository,
  DepartmentDto,
  DepartmentListResult,
  DepartmentFilters,
  CreateDepartmentData,
  UpdateDepartmentData,
} from '../interfaces';

/**
 * DepartmentRepository — Prisma adapter.
 *
 * Rules enforced here:
 * - Soft-delete pattern: deletedAt timestamp, isActive flag
 * - findAll respects status filter (active / inactive / all)
 * - Search across name and code (case-insensitive)
 * - Employee count included in every result
 */
export class DepartmentRepository implements IDepartmentRepository {
  // ── Select shape ────────────────────────────────────────────────────────────
  private readonly select = {
    id: true,
    name: true,
    code: true,
    description: true,
    managerId: true,
    isActive: true,
    deletedAt: true,
    createdAt: true,
    updatedAt: true,
    _count: { select: { employees: true } },
  } as const;

  // ── Single lookup helpers ────────────────────────────────────────────────────

  async findById(id: number): Promise<DepartmentDto | null> {
    const dept = await prisma.department.findUnique({
      where: { id },
      select: this.select,
    });
    return dept ?? null;
  }

  async findByName(name: string): Promise<DepartmentDto | null> {
    const dept = await prisma.department.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: this.select,
    });
    return dept ?? null;
  }

  async findByCode(code: string): Promise<DepartmentDto | null> {
    const dept = await prisma.department.findUnique({
      where: { code },
      select: this.select,
    });
    return dept ?? null;
  }

  // ── List with filters, search, sort, paginate ───────────────────────────────

  async findAll(filters: DepartmentFilters): Promise<DepartmentListResult> {
    const {
      search,
      status = 'active',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      pageSize = 20,
    } = filters;

    // Build WHERE clause
    const where: Prisma.DepartmentWhereInput = {};

    // Status filter
    if (status === 'active') {
      where.isActive = true;
      where.deletedAt = null;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    // Search (name OR code, case-insensitive)
    if (search !== undefined && search.trim() !== '') {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { code: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;
    const orderBy: Prisma.DepartmentOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [data, total] = await prisma.$transaction([
      prisma.department.findMany({
        where,
        select: this.select,
        orderBy,
        skip,
        take,
      }),
      prisma.department.count({ where }),
    ]);

    return { data, total };
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  async create(data: CreateDepartmentData): Promise<DepartmentDto> {
    const dept = await prisma.department.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description ?? null,
        managerId: data.managerId ?? null,
        isActive: true,
      },
      select: this.select,
    });
    return dept;
  }

  async update(id: number, data: UpdateDepartmentData): Promise<DepartmentDto> {
    const dept = await prisma.department.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.code !== undefined && { code: data.code }),
        // Allow explicit null to clear description / managerId
        ...(data.description !== undefined && { description: data.description }),
        ...(data.managerId !== undefined && { managerId: data.managerId }),
      },
      select: this.select,
    });
    return dept;
  }

  async softDelete(id: number): Promise<DepartmentDto> {
    const dept = await prisma.department.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
      select: this.select,
    });
    return dept;
  }

  async restore(id: number): Promise<DepartmentDto> {
    const dept = await prisma.department.update({
      where: { id },
      data: {
        isActive: true,
        deletedAt: null,
      },
      select: this.select,
    });
    return dept;
  }
}
