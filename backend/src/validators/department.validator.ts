import { z } from 'zod';

// ── Reusable field rules ──────────────────────────────────────────────────────

/**
 * Department code: 2–10 uppercase letters, digits, or underscores.
 * Examples: IT, HR, PROD_01, SALES_2
 */
const codeField = z
  .string()
  .min(1, 'Department code is required')
  .min(2, 'Department code must be at least 2 characters')
  .max(10, 'Department code must be at most 10 characters')
  .regex(
    /^[A-Z0-9_]+$/,
    'Department code must contain only uppercase letters, digits, or underscores',
  )
  .trim();

const nameField = z
  .string()
  .min(1, 'Department name is required')
  .min(2, 'Department name must be at least 2 characters')
  .max(100, 'Department name must be at most 100 characters')
  .trim();

const descriptionField = z
  .string()
  .max(500, 'Description must be at most 500 characters')
  .trim()
  .optional()
  .nullable();

const managerIdField = z.coerce
  .number()
  .int()
  .positive('managerId must be a positive integer')
  .optional()
  .nullable();

// ── Request body schemas ──────────────────────────────────────────────────────

export const createDepartmentSchema = z.object({
  name: nameField,
  code: codeField,
  description: descriptionField,
  managerId: managerIdField,
});

export const updateDepartmentSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Department name must be at least 2 characters')
      .max(100)
      .trim()
      .optional(),
    code: z
      .string()
      .min(2)
      .max(10)
      .regex(/^[A-Z0-9_]+$/, 'Invalid code format')
      .trim()
      .optional(),
    description: descriptionField,
    managerId: managerIdField,
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.code !== undefined ||
      data.description !== undefined ||
      data.managerId !== undefined,
    { message: 'At least one field must be provided for update' },
  );

// ── Param schemas ─────────────────────────────────────────────────────────────

export const departmentIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Department id must be a positive integer'),
});

// ── Query schemas ─────────────────────────────────────────────────────────────

export const departmentQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().max(100).trim().optional(),
  sortBy: z.enum(['name', 'code', 'createdAt', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  status: z.enum(['active', 'inactive', 'all']).optional().default('active'),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type DepartmentQueryInput = z.infer<typeof departmentQuerySchema>;
