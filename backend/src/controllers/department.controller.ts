import type { Request, Response } from 'express';
import { DepartmentService } from '../services';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response';
import type {
  CreateDepartmentInput,
  UpdateDepartmentInput,
  DepartmentQueryInput,
} from '../validators';
import type { DepartmentFilters, UpdateDepartmentData } from '../interfaces';

const departmentService = new DepartmentService();

/** Safely parse an integer route param (already validated by Zod middleware). */
function parseId(raw: string | string[] | undefined): number {
  return parseInt(String(raw ?? '0'), 10);
}

// ── Create ─────────────────────────────────────────────────────────────────

export async function createDepartment(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateDepartmentInput;
  const dept = await departmentService.create({
    name: body.name,
    code: body.code,
    description: body.description ?? null,
    managerId: body.managerId ?? null,
  });
  sendCreated(res, dept, 'Department created successfully');
}

// ── Get All ────────────────────────────────────────────────────────────────

export async function getAllDepartments(req: Request, res: Response): Promise<void> {
  // After Zod validation, query values have their defaults applied
  const query = req.query as unknown as DepartmentQueryInput;

  const filters: DepartmentFilters = {
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    status: query.status,
  };

  // Only set search if provided (exactOptionalPropertyTypes safe)
  if (query.search !== undefined) {
    filters.search = query.search;
  }

  const { data, total } = await departmentService.getAll(filters);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  sendSuccess(res, data, 200, undefined, {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
}

// ── Get by ID ──────────────────────────────────────────────────────────────

export async function getDepartmentById(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params['id']);
  const dept = await departmentService.getById(id);
  sendSuccess(res, dept);
}

// ── Update ─────────────────────────────────────────────────────────────────

export async function updateDepartment(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params['id']);
  const body = req.body as UpdateDepartmentInput;

  // Build update payload — only include fields that were explicitly sent
  const data: UpdateDepartmentData = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.code !== undefined) data.code = body.code;
  if (body.description !== undefined) data.description = body.description;
  if (body.managerId !== undefined) data.managerId = body.managerId;

  const dept = await departmentService.update(id, data);
  sendSuccess(res, dept, 200, 'Department updated successfully');
}

// ── Soft Delete ────────────────────────────────────────────────────────────

export async function deleteDepartment(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params['id']);
  await departmentService.softDelete(id);
  sendNoContent(res);
}

// ── Restore ────────────────────────────────────────────────────────────────

export async function restoreDepartment(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params['id']);
  const dept = await departmentService.restore(id);
  sendSuccess(res, dept, 200, 'Department restored successfully');
}
