// ── Domain interfaces for the Department feature ────────────────────────────
// Pure domain objects — zero Prisma imports.

export interface DepartmentDto {
  id: number;
  name: string;
  code: string;
  description: string | null;
  managerId: number | null;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { employees: number };
}

// ── Repository contract ───────────────────────────────────────────────────────

export interface DepartmentListResult {
  data: DepartmentDto[];
  total: number;
}

export interface DepartmentFilters {
  search?: string | undefined;
  status?: 'active' | 'inactive' | 'all' | undefined;
  sortBy?: 'name' | 'code' | 'createdAt' | 'updatedAt' | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface IDepartmentRepository {
  findById(id: number): Promise<DepartmentDto | null>;
  findByName(name: string): Promise<DepartmentDto | null>;
  findByCode(code: string): Promise<DepartmentDto | null>;
  findAll(filters: DepartmentFilters): Promise<DepartmentListResult>;
  create(data: CreateDepartmentData): Promise<DepartmentDto>;
  update(id: number, data: UpdateDepartmentData): Promise<DepartmentDto>;
  softDelete(id: number): Promise<DepartmentDto>;
  restore(id: number): Promise<DepartmentDto>;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateDepartmentData {
  name: string;
  code: string;
  description?: string | null;
  managerId?: number | null;
}

export interface UpdateDepartmentData {
  name?: string | undefined;
  code?: string | undefined;
  description?: string | null | undefined;
  managerId?: number | null | undefined;
}
